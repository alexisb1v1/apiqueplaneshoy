import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from '../domain/entities/event.entity';
import { ShowEntity } from '../domain/entities/show.entity';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS } from '@modules/redis/redis.constants';
import { SearchService } from '../../search/services/search.service';

export interface ExpiredStatusSyncResult {
  updatedShowsCount: number;
  updatedEventsCount: number;
  completedEventSlugs: string[];
  executedAt: Date;
}

@Injectable()
export class EventStatusCronService {
  private readonly logger = new Logger(EventStatusCronService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(ShowEntity)
    private readonly showRepository: Repository<ShowEntity>,
    private readonly redisService: RedisService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Tarea Cron programada para ejecutarse todos los días a la 1:00 AM (01:00 Hora Perú / America/Lima)
   * 1. Revisa todos los shows que ya pasaron de fecha y los actualiza a 'completed'.
   * 2. Revisa todos los eventos cuyos shows están todos vencidos y los actualiza a 'completed'.
   */
  @Cron('0 1 * * *', {
    name: 'sync-expired-shows-and-events',
    timeZone: 'America/Lima',
  })
  async handleDailyExpiredStatusCron(): Promise<void> {
    this.logger.log('⏰ [Cron 01:00 AM] Iniciando revisión automática de shows y eventos vencidos...');
    try {
      const result = await this.syncExpiredShowsAndEvents();
      this.logger.log(
        `✅ [Cron 01:00 AM] Proceso completado con éxito: ${result.updatedShowsCount} shows completados, ${result.updatedEventsCount} eventos finalizados.`,
      );
    } catch (error) {
      this.logger.error(
        `❌ [Cron 01:00 AM] Error durante la ejecución del cron de eventos vencidos: ${error instanceof Error ? error.message : error}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Ejecuta la sincronización de estados vencidos.
   * Método público que puede invocarse desde el cron o bajo demanda vía endpoint administrativo.
   */
  async syncExpiredShowsAndEvents(): Promise<ExpiredStatusSyncResult> {
    const now = new Date();
    const result: ExpiredStatusSyncResult = {
      updatedShowsCount: 0,
      updatedEventsCount: 0,
      completedEventSlugs: [],
      executedAt: now,
    };

    // =========================================================================
    // PASO 1: Revisar todos los shows que ya pasaron de fecha y cambiar su estado
    // =========================================================================
    // Un show se considera vencido si está en estado 'scheduled' u 'ongoing'
    // y su fecha de inicio + duración estimada en horas ya es menor o igual a 'now'.
    const activeShows = await this.showRepository
      .createQueryBuilder('show')
      .where('show.status IN (:...statuses)', { statuses: ['scheduled', 'ongoing'] })
      .getMany();

    const showsToComplete: ShowEntity[] = [];

    for (const show of activeShows) {
      const durationHours = show.durationHours || 2;
      const showEndTime = new Date(show.startTime.getTime() + durationHours * 60 * 60 * 1000);

      if (showEndTime <= now) {
        show.status = 'completed';
        showsToComplete.push(show);
      }
    }

    if (showsToComplete.length > 0) {
      await this.showRepository.save(showsToComplete);
      result.updatedShowsCount = showsToComplete.length;
      this.logger.log(
        `[Paso 1] Se actualizaron ${showsToComplete.length} funciones (shows) a estado 'completed'.`,
      );
    } else {
      this.logger.debug('[Paso 1] No se encontraron funciones (shows) pendientes de expirar.');
    }

    // =========================================================================
    // PASO 2: Revisar eventos que tienen todos sus shows vencidos
    // =========================================================================
    // Buscamos eventos que actualmente estén en estado 'published'.
    const publishedEvents = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.shows', 'shows')
      .where('event.status = :published', { published: 'published' })
      .getMany();

    const eventsToComplete: EventEntity[] = [];

    for (const event of publishedEvents) {
      // Si el evento no tiene funciones registradas, no se altera
      if (!event.shows || event.shows.length === 0) {
        continue;
      }

      // Evaluar si TODAS las funciones del evento han culminado
      const hasUpcomingShows = event.shows.some((show) => {
        // Las funciones canceladas no cuentan como pendientes
        if (show.status === 'cancelled') return false;

        // Si ya está marcada como completed en este momento
        if (show.status === 'completed') return false;

        // Calcular hora de cierre de la función
        const durationHours = show.durationHours || 2;
        const showEndTime = new Date(show.startTime.getTime() + durationHours * 60 * 60 * 1000);

        // Si la función aún no termina o es futura, el evento continúa activo
        return showEndTime > now || show.status === 'scheduled' || show.status === 'ongoing';
      });

      // Si no queda NINGUNA función futura o activa, el evento pasa a 'completed'
      if (!hasUpcomingShows) {
        event.status = 'completed';
        eventsToComplete.push(event);
      }
    }

    if (eventsToComplete.length > 0) {
      await this.eventRepository.save(eventsToComplete);
      result.updatedEventsCount = eventsToComplete.length;
      result.completedEventSlugs = eventsToComplete.map((e) => e.slug);

      this.logger.log(
        `[Paso 2] Se actualizaron ${eventsToComplete.length} eventos a estado 'completed': ${result.completedEventSlugs.join(', ')}`,
      );

      // =========================================================================
      // PASO 3: Sincronizar en Meilisearch y depurar caché de Redis
      // =========================================================================
      // 1. Actualizar índice de Meilisearch
      for (const event of eventsToComplete) {
        this.searchService
          .indexEvent({
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
            status: 'completed',
            minPrice: 0,
            date: event.createdAt ? event.createdAt.toISOString() : new Date().toISOString(),
            hasLandingPage: event.hasLandingPage,
            isFeatured: event.isFeatured,
          })
          .catch((err) => {
            this.logger.warn(
              `No se pudo actualizar evento ${event.id} en Meilisearch: ${err.message}`,
            );
          });

        // Invalidar caché de detalle y landing del evento
        if (event.slug) {
          await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.LANDING(event.slug));
        }
        if (event.publicUuid) {
          await this.redisService.del(REDIS_CACHE_KEYS.EVENTS.DETAIL(event.publicUuid));
        }
      }

      // 2. Invalidar caché del Home en Redis (hero, upcoming, weekly, weekend)
      await Promise.allSettled([
        this.redisService.del(REDIS_CACHE_KEYS.HOME.HERO),
        this.redisService.del(REDIS_CACHE_KEYS.HOME.UPCOMING),
        this.redisService.del(REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED),
        this.redisService.del(REDIS_CACHE_KEYS.HOME.WEEKEND),
      ]);

      this.logger.log('🧹 Caché de portada y secciones en Redis invalidada tras cambio de estados.');
    } else if (result.updatedShowsCount > 0) {
      // Si solo cambiaron shows pero no eventos completos, también refrescamos la caché de shows próximos
      await Promise.allSettled([
        this.redisService.del(REDIS_CACHE_KEYS.HOME.UPCOMING),
        this.redisService.del(REDIS_CACHE_KEYS.HOME.WEEKEND),
      ]);
    }

    return result;
  }
}

