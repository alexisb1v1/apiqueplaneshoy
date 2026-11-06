import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from '@events/domain/entities/event.entity';
import { resolveCityFromUbigeo } from '@events/constants/event-constants';
import { SearchEventsRequestDto } from '../dto/search-events.request.dto';
import { SearchEventsResponseDto, EventSearchItemDto } from '../dto/search-events.response.dto';
import { PublishedCityResponseDto } from '../dto/published-city.response.dto';
import { plainToInstance } from 'class-transformer';

export interface EventIndexPayload {
  id: string;
  publicUuid: string;
  title: string;
  slug: string;
  description?: string | null;
  category: string;
  tags?: string[];
  venue?: string | null;
  address?: string | null;
  ubigeoCode?: string | null;
  city?: string | null;
  departmentCode?: string | null;
  status: string;
  minPrice: number;
  date?: string | null;
  bannerUrl?: string | null;
  hasLandingPage: boolean;
  isFeatured?: boolean;
  _geo?: { lat: number; lng: number };
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private host: string | null = null;
  private apiKey: string | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  async onModuleInit() {
    await this.initMeilisearch();
  }

  private async initMeilisearch(): Promise<void> {
    const rawHost = this.configService.get<string>('MEILISEARCH_HOST');
    const rawApiKey = this.configService.get<string>('MEILISEARCH_API_KEY');

    // Validación preventiva: verificar si MEILISEARCH_HOST está configurado y no es un placeholder
    if (!rawHost || rawHost.includes('<') || rawHost.includes('>')) {
      this.logger.warn(
        'Meilisearch deshabilitado: MEILISEARCH_HOST no está configurado o contiene placeholders.',
      );
      return;
    }

    this.host = rawHost.replace(/\/+$/, '');
    this.apiKey = rawApiKey && !rawApiKey.includes('tu_MEILI_MASTER_KEY') ? rawApiKey : null;

    try {
      // 1. Validar salud del servidor con timeout explícito de 3 segundos (DevSecOps)
      const res = await fetch(`${this.host}/health`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });

      if (!res.ok) {
        this.logger.warn(`Meilisearch respondió con status ${res.status}: ${res.statusText}`);
        return;
      }

      const health = await res.json();
      if (health.status !== 'available') {
        this.logger.warn(`Meilisearch reporta estado: ${health.status}`);
        return;
      }

      // 2. Configurar ajustes del índice "events"
      await this.configureIndex();

      this.isConnected = true;
      this.logger.log(`Conexión exitosa a Meilisearch en ${this.host}. Índice "events" listo.`);

      // 3. Sincronización inicial automática de eventos existentes
      this.syncAllEvents().catch((err) => {
        this.logger.warn(`Sincronización inicial en segundo plano no completada: ${err.message || err}`);
      });
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(
        `No se pudo conectar a Meilisearch (${this.host}): ${err.message || err}. El motor operará en modo pasivo.`,
      );
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Configura las reglas del índice de eventos: atributos buscables, filtrables y ordenables
   */
  private async configureIndex(): Promise<void> {
    if (!this.host) return;

    try {
      // Asegurar creación del índice si no existe
      await fetch(`${this.host}/indexes`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ uid: 'events', primaryKey: 'id' }),
        signal: AbortSignal.timeout(4000),
      });

      // Configurar reglas
      await fetch(`${this.host}/indexes/events/settings`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({
          searchableAttributes: [
            'title',
            'description',
            'venue',
            'category',
            'city',
            'tags',
            'address',
          ],
          filterableAttributes: [
            'category',
            'city',
            'departmentCode',
            'ubigeoCode',
            'status',
            'minPrice',
            'date',
            'hasLandingPage',
          ],
          sortableAttributes: ['date', 'minPrice'],
          rankingRules: [
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness',
          ],
        }),
        signal: AbortSignal.timeout(4000),
      });
    } catch (err: any) {
      this.logger.warn(`No se pudieron actualizar los settings de Meilisearch: ${err.message || err}`);
    }
  }

  /**
   * Indica si el cliente de Meilisearch está actualmente conectado y operativo
   */
  public isReady(): boolean {
    return this.isConnected && this.host !== null;
  }

  /**
   * Sincroniza y reindexa únicamente los eventos en estado 'published' de PostgreSQL en Meilisearch.
   * Purga previamente el índice para asegurar que ningún borrador (draft) quede expuesto al público.
   */
  async syncAllEvents(): Promise<{ indexedCount: number; totalFound: number }> {
    if (!this.isReady()) {
      return { indexedCount: 0, totalFound: 0 };
    }

    try {
      // 1. Limpiar todos los documentos anteriores en Meilisearch para erradicar borradores previos
      await fetch(`${this.host}/indexes/events/documents`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });

      // 2. Consultar estrictamente eventos con status = 'published'
      const events = await this.eventRepository.find({
        where: { status: 'published' },
        relations: {
          images: true,
          shows: true,
          zones: true,
        },
        order: { createdAt: 'DESC' },
      });

      if (!events || events.length === 0) {
        this.logger.log('Sincronización Meilisearch: No se encontraron eventos publicados en PostgreSQL.');
        return { indexedCount: 0, totalFound: 0 };
      }

      const documents: EventIndexPayload[] = events.map((event) => {
        const banner = event.images?.find((img) => img.imageType === 'banner') || event.images?.[0];
        const prices = (event.zones || []).map((z) => Number(z.regularPrice)).filter((p) => !isNaN(p) && p >= 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const firstShow = (event.shows || []).sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        )[0];
        const date = firstShow?.startTime
          ? new Date(firstShow.startTime).toISOString()
          : (event.createdAt ? event.createdAt.toISOString() : new Date().toISOString());

        const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);

        return {
          id: event.id.toString(),
          publicUuid: event.publicUuid,
          title: event.name,
          slug: event.slug,
          description: event.description,
          category: event.category,
          tags: event.tags || [],
          venue: event.venue,
          address: event.address,
          ubigeoCode: event.ubigeoCode,
          city: cityInfo.name,
          departmentCode: cityInfo.departmentCode,
          status: event.status,
          minPrice,
          date,
          bannerUrl: banner?.imageUrl || null,
          hasLandingPage: event.hasLandingPage,
          isFeatured: event.isFeatured,
        };
      });

      const res = await fetch(`${this.host}/indexes/events/documents?primaryKey=id`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(documents),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        this.logger.log(`Sincronización Meilisearch completada: ${documents.length} eventos indexados.`);
        return { indexedCount: documents.length, totalFound: events.length };
      } else {
        const errText = await res.text();
        this.logger.error(`Error en sincronización masiva a Meilisearch: ${errText}`);
        return { indexedCount: 0, totalFound: events.length };
      }
    } catch (err: any) {
      this.logger.error(`Excepción en sincronización masiva de eventos: ${err.message || err}`);
      return { indexedCount: 0, totalFound: 0 };
    }
  }

  /**
   * Indexa o actualiza un evento en Meilisearch
   */
  async indexEvent(payload: EventIndexPayload): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    // Regla de Oro DevSecOps: NUNCA indexar eventos en borrador (draft) en la cartelera pública
    if (payload.status !== 'published') {
      this.logger.warn(
        `Evento ${payload.id} no indexado en Meilisearch porque su estado es '${payload.status}' (solo se indexa 'published'). Removiendo del índice si existía...`,
      );
      await this.removeEvent(payload.id);
      return false;
    }

    try {
      if (!payload.city || !payload.departmentCode) {
        const cityInfo = resolveCityFromUbigeo(payload.ubigeoCode);
        payload.city = payload.city || cityInfo.name;
        payload.departmentCode = payload.departmentCode || cityInfo.departmentCode;
      }

      const res = await fetch(`${this.host}/indexes/events/documents?primaryKey=id`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify([payload]),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Error al indexar evento ${payload.id}: ${errorText}`);
        return false;
      }

      this.logger.log(`Evento ${payload.id} (${payload.title}) indexado en Meilisearch.`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error al indexar evento ${payload.id}: ${err.message || err}`);
      return false;
    }
  }

  /**
   * Elimina un evento del índice de Meilisearch
   */
  async removeEvent(eventId: string | number): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      const res = await fetch(`${this.host}/indexes/events/documents/${eventId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        this.logger.error(`Error al eliminar evento ${eventId}: ${errorText}`);
        return false;
      }

      this.logger.log(`Evento ${eventId} eliminado de Meilisearch.`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error al eliminar evento ${eventId}: ${err.message || err}`);
      return false;
    }
  }

  /**
   * Búsqueda instantánea de eventos con tolerancia a errores y filtros facetados
   */
  async searchEvents(dto: SearchEventsRequestDto): Promise<SearchEventsResponseDto> {
    const defaultResponse: SearchEventsResponseDto = {
      hits: [],
      totalHits: 0,
      processingTimeMs: 0,
      query: dto.q || '',
      limit: dto.limit || 20,
      offset: dto.offset || 0,
    };

    if (!this.isReady()) {
      return this.searchEventsFromPostgres(dto);
    }

    try {
      const filters: string[] = [];

      // Filtro de estado: en la búsqueda pública solo se exponen eventos publicados
      filters.push("status = 'published'");

      if (dto.category) {
        filters.push(`category = '${dto.category.toUpperCase()}'`);
      }
      if (dto.ubigeoCode) {
        filters.push(`ubigeoCode = '${dto.ubigeoCode}'`);
      }
      if (dto.city && dto.city !== 'Todas' && dto.city !== 'Todos') {
        filters.push(`city = '${dto.city}'`);
      }
      if (dto.minPrice !== undefined) {
        filters.push(`minPrice >= ${dto.minPrice}`);
      }
      if (dto.maxPrice !== undefined) {
        filters.push(`minPrice <= ${dto.maxPrice}`);
      }

      const startTime = Date.now();
      const res = await fetch(`${this.host}/indexes/events/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          q: dto.q || '',
          filter: filters.length > 0 ? filters.join(' AND ') : undefined,
          limit: dto.limit || 20,
          offset: dto.offset || 0,
          sort: ['date:asc'],
        }),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) {
        return this.searchEventsFromPostgres(dto);
      }

      const data = await res.json();
      const processingTimeMs = data.processingTimeMs ?? (Date.now() - startTime);

      const hits = (data.hits || []).map((hit: any) =>
        plainToInstance(EventSearchItemDto, hit, { excludeExtraneousValues: true }),
      );

      // Si Meilisearch no arrojó resultados y no hay filtros restrictivos, respaldar con PostgreSQL
      if (hits.length === 0 && !dto.q && !dto.category && !dto.city && dto.minPrice === undefined && dto.maxPrice === undefined) {
        return this.searchEventsFromPostgres(dto);
      }

      return {
        hits,
        totalHits: data.estimatedTotalHits ?? hits.length,
        processingTimeMs,
        query: dto.q || '',
        limit: dto.limit || 20,
        offset: dto.offset || 0,
      };
    } catch (err: any) {
      this.logger.error(`Error al buscar en Meilisearch: ${err.message || err}. Usando fallback a PostgreSQL...`);
      return this.searchEventsFromPostgres(dto);
    }
  }

  /**
   * Respaldo resiliente de búsqueda directamente en PostgreSQL cuando Meilisearch no está disponible.
   * Diseñado bajo directivas DevSecOps de Alta Disponibilidad y Tolerancia a Fallos.
   */
  private async searchEventsFromPostgres(dto: SearchEventsRequestDto): Promise<SearchEventsResponseDto> {
    const startTime = Date.now();
    try {
      const qb = this.eventRepository
        .createQueryBuilder('event')
        .leftJoinAndSelect('event.images', 'images')
        .leftJoinAndSelect('event.zones', 'zones')
        .leftJoinAndSelect('event.shows', 'shows')
        .where('event.status = :status', { status: 'published' });

      if (dto.q && dto.q.trim()) {
        const queryTerm = `%${dto.q.trim().toLowerCase()}%`;
        qb.andWhere(
          '(LOWER(event.name) LIKE :q OR LOWER(event.description) LIKE :q OR LOWER(event.venue) LIKE :q OR LOWER(event.address) LIKE :q)',
          { q: queryTerm },
        );
      }

      if (dto.category && dto.category !== 'Todas' && dto.category !== 'Todos') {
        qb.andWhere('UPPER(event.category) = :category', {
          category: dto.category.toUpperCase(),
        });
      }

      const allEvents = await qb.orderBy('event.createdAt', 'DESC').getMany();

      // Filtrado complementario por ciudad y precio
      let filtered = allEvents;

      if (dto.city && dto.city !== 'Todas' && dto.city !== 'Todos') {
        const targetCity = dto.city.toLowerCase().trim();
        filtered = filtered.filter((ev) => {
          const cityInfo = resolveCityFromUbigeo(ev.ubigeoCode);
          return (
            cityInfo.name.toLowerCase().includes(targetCity) ||
            (ev.address && ev.address.toLowerCase().includes(targetCity)) ||
            (ev.venue && ev.venue.toLowerCase().includes(targetCity))
          );
        });
      }

      // Mapear a EventSearchItemDto
      let items: EventSearchItemDto[] = filtered.map((event) => {
        const banner =
          event.images?.find((img) => img.imageType === 'banner') || event.images?.[0];
        const prices = (event.zones || [])
          .map((z) => Number(z.regularPrice))
          .filter((p) => !isNaN(p) && p >= 0);
        const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
        const firstShow = (event.shows || []).sort(
          (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
        )[0];
        const date = firstShow?.startTime
          ? new Date(firstShow.startTime).toISOString()
          : (event.createdAt ? event.createdAt.toISOString() : new Date().toISOString());

        const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);

        return plainToInstance(
          EventSearchItemDto,
          {
            id: event.id.toString(),
            publicUuid: event.publicUuid,
            title: event.name,
            slug: event.slug,
            description: event.description,
            category: event.category,
            tags: event.tags || [],
            venue: event.venue,
            ubigeoCode: event.ubigeoCode,
            city: cityInfo.name,
            departmentCode: cityInfo.departmentCode,
            minPrice,
            date,
            bannerUrl: banner?.imageUrl || null,
            hasLandingPage: event.hasLandingPage,
            isFeatured: event.isFeatured,
          },
          { excludeExtraneousValues: true },
        );
      });

      // Filtro de precio
      if (dto.minPrice !== undefined) {
        items = items.filter((item) => item.minPrice >= dto.minPrice!);
      }
      if (dto.maxPrice !== undefined) {
        items = items.filter((item) => item.minPrice <= dto.maxPrice!);
      }

      const totalHits = items.length;
      const limit = dto.limit || 20;
      const offset = dto.offset || 0;
      const paginatedHits = items.slice(offset, offset + limit);

      return {
        hits: paginatedHits,
        totalHits,
        processingTimeMs: Date.now() - startTime,
        query: dto.q || '',
        limit,
        offset,
      };
    } catch (err: any) {
      this.logger.error(`Error en fallback PostgreSQL de búsqueda: ${err.message || err}`);
      return {
        hits: [],
        totalHits: 0,
        processingTimeMs: Date.now() - startTime,
        query: dto.q || '',
        limit: dto.limit || 20,
        offset: dto.offset || 0,
      };
    }
  }

  /**
   * Obtiene la lista de ciudades que cuentan con eventos en estado 'published'.
   * Si no hay eventos publicados en una ciudad, no aparecerá en el listado.
   */
  async getPublishedCities(): Promise<PublishedCityResponseDto[]> {
    try {
      const publishedEvents = await this.eventRepository.find({
        where: { status: 'published' },
        select: { id: true, ubigeoCode: true },
      });

      if (!publishedEvents || publishedEvents.length === 0) {
        return [];
      }

      const cityCounts = new Map<
        string,
        { id: string; name: string; departmentCode: string; count: number }
      >();

      for (const event of publishedEvents) {
        const cityInfo = resolveCityFromUbigeo(event.ubigeoCode);
        const key = cityInfo.id;
        const existing = cityCounts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          cityCounts.set(key, { ...cityInfo, count: 1 });
        }
      }

      return Array.from(cityCounts.values())
        .map((c) =>
          plainToInstance(
            PublishedCityResponseDto,
            {
              id: c.id,
              name: c.name,
              departmentCode: c.departmentCode,
              eventCount: c.count,
            },
            { excludeExtraneousValues: true },
          ),
        )
        .sort((a, b) => b.eventCount - a.eventCount || a.name.localeCompare(b.name));
    } catch (err: any) {
      this.logger.error(`Error al obtener ciudades con eventos publicados: ${err.message || err}`);
      return [];
    }
  }
}
