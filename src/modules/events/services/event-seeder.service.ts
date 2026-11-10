import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from '../domain/entities/event.entity';
import { ShowEntity } from '../domain/entities/show.entity';
import { ZoneEntity } from '../domain/entities/zone.entity';
import { ZonePricingTierEntity } from '../domain/entities/zone-pricing-tier.entity';
import { EventImageEntity } from '../domain/entities/event-image.entity';
import { CouponEntity } from '@orders/domain/entities/coupon.entity';
import { UserEntity } from '@users/domain/entities/user.entity';
import { RedisService } from '@modules/redis/redis.service';
import { REDIS_CACHE_KEYS } from '@modules/redis/redis.constants';
import { SearchService } from '../../search/services/search.service';
import { SeedEventsResponseDto, SeededEventSummaryDto } from '../dto/seed-events.response.dto';

interface EventTemplate {
  name: string;
  category: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  ubigeoCode: string;
  coordinates: string;
  bannerUrl: string;
  galleryUrls: string[];
  zones: Array<{
    name: string;
    title: string;
    color: string;
    capacity: number;
    regularPrice: number;
    tiers: Array<{ name: string; price: number; capacity: number }>;
  }>;
  hasLandingPage?: boolean;
  videoTeaserUrl?: string;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    name: 'Grupo 5 en Concierto - Noche de Oro',
    category: 'CONCERTS',
    description: 'La orquesta de cumbia más aclamada del Perú llega con su espectáculo sinfónico en vivo. Más de 3 horas de éxitos, luces inteligentes y sonido de última generación.',
    venue: 'Campo Ferial de Yarinacocha',
    address: 'Av. Yarinacocha 954, Pucallpa',
    city: 'Pucallpa',
    ubigeoCode: '250102',
    coordinates: '-8.35193, -74.56877',
    bannerUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
    ],
    zones: [
      {
        name: 'VIP',
        title: 'Acceso VIP Frente al Escenario',
        color: '#EF4444',
        capacity: 350,
        regularPrice: 130.0,
        tiers: [
          { name: 'Preventa 1 - Early Fan', price: 95.0, capacity: 100 },
          { name: 'Preventa 2 - Regular VIP', price: 115.0, capacity: 120 },
        ],
      },
      {
        name: 'GENERAL',
        title: 'Pista General Central',
        color: '#10B981',
        capacity: 800,
        regularPrice: 65.0,
        tiers: [
          { name: 'Preventa 1 - General', price: 45.0, capacity: 300 },
        ],
      },
    ],
    hasLandingPage: true,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
  },
  {
    name: 'Festival Selva Viva 2026 - Cumbia & Huayno Electrónico',
    category: 'FESTIVALS',
    description: 'El festival musical más imponente de la Amazonía peruana. Dos escenarios simultáneos, gastronomía regional típica, feria de emprendedores y 14 artistas en escena.',
    venue: 'Explanada del Malecón Grau',
    address: 'Malecón Grau s/n, Pucallpa',
    city: 'Pucallpa',
    ubigeoCode: '250101',
    coordinates: '-8.38210, -74.53200',
    bannerUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80',
    ],
    zones: [
      {
        name: 'EXPERIENCIA AMAZON',
        title: 'Zona Lounge + Barra Libre',
        color: '#8B5CF6',
        capacity: 150,
        regularPrice: 220.0,
        tiers: [
          { name: 'Preventa Fans', price: 180.0, capacity: 50 },
        ],
      },
      {
        name: 'CAMPO',
        title: 'Acceso General a Dos Escenarios',
        color: '#3B82F6',
        capacity: 1200,
        regularPrice: 50.0,
        tiers: [
          { name: 'Preventa 1', price: 35.0, capacity: 400 },
          { name: 'Preventa 2', price: 42.0, capacity: 400 },
        ],
      },
    ],
    hasLandingPage: true,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=09R8_2nJtjg',
  },
  {
    name: 'Carlos Álvarez - Habla Causa Stand Up',
    category: 'COMEDY',
    description: 'Una noche de carcajadas inolvidables con la mejor sátira política y personajes icónicos de la televisión peruana. Función única con aforo limitado.',
    venue: 'Teatro Municipal de Lima',
    address: 'Jr. Ica 377, Cercado de Lima',
    city: 'Lima',
    ubigeoCode: '150101',
    coordinates: '-12.04430, -77.03450',
    bannerUrl: 'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1514306191717-452ec28c7814?auto=format&fit=crop&w=800&q=80',
    ],
    zones: [
      {
        name: 'PLATEA BAJA',
        title: 'Primeras Filas Numeradas',
        color: '#F59E0B',
        capacity: 180,
        regularPrice: 90.0,
        tiers: [
          { name: 'Preventa Exclusiva', price: 75.0, capacity: 60 },
        ],
      },
      {
        name: 'MEZZANINE',
        title: 'Vista Panorámica del Escenario',
        color: '#10B981',
        capacity: 250,
        regularPrice: 55.0,
        tiers: [],
      },
    ],
    hasLandingPage: false,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
  },
  {
    name: 'Armonía 10 - La Primerísima en Vivo',
    category: 'CONCERTS',
    description: 'Celebra más de 50 años de historia de la cumbia piurana. Todos los éxitos que marcaron generaciones en un concierto monumental.',
    venue: 'Estadio Aliardo Soria Pérez',
    address: 'Jr. Inmaculada 450, Pucallpa',
    city: 'Pucallpa',
    ubigeoCode: '250101',
    coordinates: '-8.37915, -74.55387',
    bannerUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=800&q=80',
    ],
    zones: [
      {
        name: 'BOX VIP',
        title: 'Box Privado para 8 Personas',
        color: '#EC4899',
        capacity: 80,
        regularPrice: 200.0,
        tiers: [],
      },
      {
        name: 'GENERAL',
        title: 'Tribuna y Pista General',
        color: '#3B82F6',
        capacity: 1500,
        regularPrice: 40.0,
        tiers: [
          { name: 'Preventa Promocional', price: 30.0, capacity: 500 },
        ],
      },
    ],
    hasLandingPage: true,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
  },
  {
    name: 'El Rey León - El Gran Musical',
    category: 'THEATER',
    description: 'La magia de Broadway adaptada por el más talentoso elenco de teatro musical peruano. Vestuarios asombrosos, orquesta en vivo y acrobacias aéreas.',
    venue: 'Gran Teatro Nacional',
    address: 'Av. Javier Prado Este 2225, San Borja, Lima',
    city: 'Lima',
    ubigeoCode: '150130',
    coordinates: '-12.08740, -77.00490',
    bannerUrl: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?auto=format&fit=crop&w=800&q=80',
    ],
    zones: [
      {
        name: 'PLATEA PREFERENCIAL',
        title: 'Ubicación Central Central',
        color: '#6366F1',
        capacity: 220,
        regularPrice: 160.0,
        tiers: [
          { name: 'Preventa Familiar', price: 135.0, capacity: 80 },
        ],
      },
      {
        name: 'PISO 2 CENTRAL',
        title: 'Balcón Central',
        color: '#06B6D4',
        capacity: 300,
        regularPrice: 85.0,
        tiers: [],
      },
    ],
    hasLandingPage: true,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=7TavVZMewpY',
  },
  {
    name: 'Copa Regional de Pádel Open Pucallpa 2026',
    category: 'SPORTS',
    description: 'El torneo oficial de pádel más importante del oriente peruano. Más de 64 parejas compitiendo en categorías Primera, Segunda y Mixtos con premios en efectivo.',
    venue: 'Club Campestre Pucallpa',
    address: 'Carretera Federico Basadre Km 6, Pucallpa',
    city: 'Pucallpa',
    ubigeoCode: '250102',
    coordinates: '-8.39500, -74.58000',
    bannerUrl: 'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [],
    zones: [
      {
        name: 'GRADERÍA GENERAL',
        title: 'Acceso a Todas las Canchas',
        color: '#10B981',
        capacity: 400,
        regularPrice: 25.0,
        tiers: [],
      },
    ],
    hasLandingPage: false,
  },
  {
    name: 'Feria Gastronómica Mistura Amazónica',
    category: 'GASTRONOMY',
    description: 'Juane gigante, cecina con tacacho, paiche a la parrilla, tragos exóticos de camu camu y cocona. Tres días de fiesta con los mejores chefs del Perú.',
    venue: 'Boulevard de Yarinacocha',
    address: 'Malecón Turístico Yarinacocha, Pucallpa',
    city: 'Pucallpa',
    ubigeoCode: '250102',
    coordinates: '-8.35500, -74.57100',
    bannerUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    galleryUrls: [],
    zones: [
      {
        name: 'PASE DÍA COMPLETO',
        title: 'Incluye 2 Degustaciones Típicas',
        color: '#F97316',
        capacity: 600,
        regularPrice: 35.0,
        tiers: [
          { name: 'Preventa Degustación', price: 25.0, capacity: 200 },
        ],
      },
    ],
    hasLandingPage: true,
    videoTeaserUrl: 'https://www.youtube.com/watch?v=09R8_2nJtjg',
  },
];

@Injectable()
export class EventSeederService {
  private readonly logger = new Logger(EventSeederService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(ShowEntity)
    private readonly showRepository: Repository<ShowEntity>,
    @InjectRepository(ZoneEntity)
    private readonly zoneRepository: Repository<ZoneEntity>,
    @InjectRepository(ZonePricingTierEntity)
    private readonly tierRepository: Repository<ZonePricingTierEntity>,
    @InjectRepository(EventImageEntity)
    private readonly imageRepository: Repository<EventImageEntity>,
    @InjectRepository(CouponEntity)
    private readonly couponRepository: Repository<CouponEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly redisService: RedisService,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Genera masivamente eventos de prueba con funciones pasadas, de hoy y futuras,
   * incluyendo cupones promocionales y videos de YouTube en landing pages.
   * @param count Cantidad solicitada por el usuario (default: 10)
   */
  async seedEvents(count: number = 10): Promise<SeedEventsResponseDto> {
    const validCount = Math.max(1, Math.min(count, 100));
    this.logger.log(`🌱 Iniciando generación masiva de ${validCount} eventos de prueba con cupones y videos...`);

    // 1. Obtener o crear organizador de prueba
    const organizer = await this.getOrCreateOrganizer();
    const currentTotalEvents = await this.eventRepository.count();

    const seededEvents: SeededEventSummaryDto[] = [];
    let pastCount = 0;
    let upcomingCount = 0;
    let totalCouponsCount = 0;

    const baseNow = new Date();

    for (let i = 0; i < validCount; i++) {
      const template = EVENT_TEMPLATES[(currentTotalEvents + i) % EVENT_TEMPLATES.length];
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const eventNumber = currentTotalEvents + i + 1;
      const eventName = `${template.name} #${eventNumber}`;
      const slug = `${this.slugify(template.name)}-${randomSuffix}`;

      // Distribuir escenarios temporales para probar tanto el Cron como la cartelera:
      // - Índice múltiplo de 4 (25%): EVENTO PASADO (ayer o anteayer) -> Ideal para probar el Cron de 1:00 AM
      // - Índice múltiplo de 4 + 1 (25%): EVENTO DE HOY
      // - Índice múltiplo de 4 + 2 (25%): EVENTO DE FIN DE SEMANA
      // - Índice múltiplo de 4 + 3 (25%): EVENTO FUTURO (próximo mes)
      const scenario = i % 4;
      let showDate: Date;
      let isPastScenario = false;

      if (scenario === 0) {
        // Evento Pasado: Show hace 1 o 2 días atrás
        const daysAgo = 1 + (i % 3);
        showDate = new Date(baseNow.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        showDate.setHours(20, 0, 0, 0);
        isPastScenario = true;
        pastCount++;
      } else if (scenario === 1) {
        // Evento de Hoy: Esta noche a las 21:00
        showDate = new Date(baseNow);
        showDate.setHours(21, 0, 0, 0);
        if (showDate.getTime() <= baseNow.getTime()) {
          showDate = new Date(baseNow.getTime() + 3 * 60 * 60 * 1000);
        }
        upcomingCount++;
      } else if (scenario === 2) {
        // Evento de Fin de Semana (próximo sábado)
        const daysToSaturday = (6 - baseNow.getDay() + 7) % 7 || 7;
        showDate = new Date(baseNow.getTime() + daysToSaturday * 24 * 60 * 60 * 1000);
        showDate.setHours(20, 30, 0, 0);
        upcomingCount++;
      } else {
        // Evento Futuro: en 12 a 35 días
        const daysForward = 12 + ((i * 3) % 25);
        showDate = new Date(baseNow.getTime() + daysForward * 24 * 60 * 60 * 1000);
        showDate.setHours(19, 0, 0, 0);
        upcomingCount++;
      }

      // Configuración de Landing Page y Video de YouTube
      const isFeatured = i < 3; // Los 3 primeros son destacados para el Hero Carousel
      const hasLandingPage = !!template.hasLandingPage;
      const videoTeaserUrl = hasLandingPage ? template.videoTeaserUrl || 'https://www.youtube.com/watch?v=kJQP7kiw5Fk' : null;

      const event = this.eventRepository.create({
        name: eventName,
        slug,
        description: template.description,
        organizerId: organizer.id,
        category: template.category,
        tags: [template.category.toLowerCase(), template.city.toLowerCase(), 'entradas-oficiales'],
        venue: template.venue,
        address: template.address,
        ubigeoCode: template.ubigeoCode,
        coordinates: template.coordinates,
        isFeatured,
        hasLandingPage,
        status: 'published',
        userTicketLimit: 6,
        landingConfig: hasLandingPage
          ? {
              theme: {
                primaryColor: '#6366F1',
                secondaryColor: '#4F46E5',
                backgroundType: 'color',
                backgroundColor: '#0F172A',
              },
              header: {
                title: eventName,
                subtitle: `Experiencia exclusiva en ${template.city}`,
                ctaText: 'Asegurar Entradas Ahora',
                headerImageUrl: template.bannerUrl,
                videoTeaserUrl: videoTeaserUrl,
              },
              body: {
                highlight1: 'Acceso digital garantizado con código QR Ed25519',
                highlight2: 'Sonido line-array y pantallas LED de alta resolución',
                highlight3: 'Seguridad privada, puestos de primeros auxilios y zona gastronómica',
                highlight4: 'Estacionamiento vigilado con capacidad para más de 200 vehículos',
              },
              footer: {
                instagramUrl: 'https://instagram.com/queplaneshoy',
                tiktokUrl: 'https://tiktok.com/@queplaneshoy',
                facebookUrl: 'https://facebook.com/queplaneshoy',
              },
            }
          : null,
      });

      const savedEvent = await this.eventRepository.save(event);

      // Crear Función (Show)
      const show = this.showRepository.create({
        eventId: savedEvent.id,
        name: 'Función Principal Estelar',
        startTime: showDate,
        durationHours: 2,
        status: 'scheduled',
      });
      await this.showRepository.save(show);

      let totalShows = 1;
      if (i % 3 === 0) {
        const nextDayShow = new Date(showDate.getTime() + 24 * 60 * 60 * 1000);
        const secondShow = this.showRepository.create({
          eventId: savedEvent.id,
          name: 'Segunda Función - Gran Cierre',
          startTime: nextDayShow,
          durationHours: 2,
          status: 'scheduled',
        });
        await this.showRepository.save(secondShow);
        totalShows = 2;
      }

      // Crear Zonas y Tiers
      let totalZones = 0;
      for (const z of template.zones) {
        const zone = this.zoneRepository.create({
          eventId: savedEvent.id,
          name: z.name,
          title: z.title,
          color: z.color,
          capacity: z.capacity,
          regularPrice: z.regularPrice,
          serviceFee: Math.round(z.regularPrice * 0.1),
          maxTicketsPerOrder: 4,
        });
        const savedZone = await this.zoneRepository.save(zone);
        totalZones++;

        let tierNum = 1;
        for (const t of z.tiers) {
          const tier = this.tierRepository.create({
            zoneId: savedZone.id,
            tierNumber: tierNum++,
            name: t.name,
            price: t.price,
            capacity: t.capacity,
            isActive: true,
          });
          await this.tierRepository.save(tier);
        }
      }

      // Crear Imágenes
      if (template.bannerUrl) {
        const bannerImage = this.imageRepository.create({
          eventId: savedEvent.id,
          imageUrl: template.bannerUrl,
          imageType: 'banner',
          sortOrder: 0,
        });
        await this.imageRepository.save(bannerImage);
      }

      for (let gIdx = 0; gIdx < template.galleryUrls.length; gIdx++) {
        const galleryImage = this.imageRepository.create({
          eventId: savedEvent.id,
          imageUrl: template.galleryUrls[gIdx],
          imageType: 'gallery',
          sortOrder: gIdx + 1,
        });
        await this.imageRepository.save(galleryImage);
      }

      // =========================================================================
      // GENERACIÓN DE CUPONES DE DESCUENTO PARA ESTE EVENTO
      // =========================================================================
      const eventCoupons: string[] = [];

      // 1. Cupón Porcentual (15% de descuento)
      const percentCode = `PROMO15-${randomSuffix.toUpperCase()}`;
      const coupon1 = this.couponRepository.create({
        eventId: savedEvent.id,
        organizerId: organizer.id,
        code: percentCode,
        discountType: 'percentage',
        discountValue: 15.0,
        usageType: 'reusable',
        maxUses: 150,
        usedCount: 0,
        minOrderAmount: 30.0,
        startsAt: baseNow,
        isActive: true,
      });
      await this.couponRepository.save(coupon1);
      eventCoupons.push(percentCode);
      totalCouponsCount++;

      // 2. Cupón de Monto Fijo (S/ 20.00 de descuento directo)
      const fixedCode = `VIP20-${randomSuffix.toUpperCase()}`;
      const coupon2 = this.couponRepository.create({
        eventId: savedEvent.id,
        organizerId: organizer.id,
        code: fixedCode,
        discountType: 'fixed',
        discountValue: 20.0,
        usageType: 'reusable',
        maxUses: 100,
        usedCount: 0,
        minOrderAmount: 60.0,
        startsAt: baseNow,
        isActive: true,
      });
      await this.couponRepository.save(coupon2);
      eventCoupons.push(fixedCode);
      totalCouponsCount++;

      // Sincronizar en MeiliSearch
      this.searchService
        .indexEvent({
          id: savedEvent.id.toString(),
          publicUuid: savedEvent.publicUuid,
          title: savedEvent.name,
          slug: savedEvent.slug,
          description: savedEvent.description,
          category: savedEvent.category,
          tags: savedEvent.tags || [],
          venue: savedEvent.venue,
          address: savedEvent.address,
          ubigeoCode: savedEvent.ubigeoCode,
          status: savedEvent.status,
          minPrice: template.zones[0]?.regularPrice || 0,
          date: showDate.toISOString(),
          hasLandingPage: savedEvent.hasLandingPage,
          isFeatured: savedEvent.isFeatured,
        })
        .catch(() => {});

      seededEvents.push({
        id: savedEvent.id.toString(),
        name: savedEvent.name,
        slug: savedEvent.slug,
        category: savedEvent.category,
        city: template.city,
        status: savedEvent.status,
        isFeatured: savedEvent.isFeatured,
        hasLandingPage: savedEvent.hasLandingPage,
        firstShowTime: showDate.toISOString(),
        isPast: isPastScenario,
        showsCount: totalShows,
        zonesCount: totalZones,
        hasYoutubeVideo: Boolean(videoTeaserUrl),
        videoTeaserUrl,
        coupons: eventCoupons,
      });
    }

    // Invalidar caché de Redis para refresco instantáneo en la Home
    await Promise.allSettled([
      this.redisService.del(REDIS_CACHE_KEYS.HOME.HERO),
      this.redisService.del(REDIS_CACHE_KEYS.HOME.UPCOMING),
      this.redisService.del(REDIS_CACHE_KEYS.HOME.WEEKLY_FEATURED),
      this.redisService.del(REDIS_CACHE_KEYS.HOME.WEEKEND),
    ]);

    this.logger.log(
      `🎉 Carga masiva exitosa: ${validCount} eventos creados (${pastCount} con funciones pasadas, ${upcomingCount} vigentes, ${totalCouponsCount} cupones activos).`,
    );

    return {
      requestedCount: validCount,
      createdCount: seededEvents.length,
      totalCouponsCount,
      pastEventsCount: pastCount,
      upcomingEventsCount: upcomingCount,
      message: `Se crearon ${seededEvents.length} eventos y ${totalCouponsCount} cupones de descuento exitosamente con videos de YouTube en Landing Pages.`,
      events: seededEvents,
    };
  }

  /**
   * Obtiene o crea un organizador oficial para asociar los eventos de prueba
   */
  private async getOrCreateOrganizer(): Promise<UserEntity> {
    const existingOrganizer = await this.userRepository.findOne({
      where: { isOrganizer: true },
    });

    if (existingOrganizer) {
      return existingOrganizer;
    }

    const firstUser = await this.userRepository.findOne({ where: {} });
    if (firstUser) {
      firstUser.isOrganizer = true;
      firstUser.organizerName = firstUser.name || 'Productora Oficial QPH';
      firstUser.organizerDocumentType = 'RUC';
      firstUser.organizerDocumentNumber = '20601234567';
      return this.userRepository.save(firstUser);
    }

    const newOrganizer = this.userRepository.create({
      name: 'QPH Productora Oficial',
      email: 'organizador.demo@queplaneshoy.com',
      role: 'admin',
      isOrganizer: true,
      organizerName: 'QPH Live Events SAC',
      organizerDocumentType: 'RUC',
      organizerDocumentNumber: '20609876543',
      organizerPhone: '+51 987 654 321',
    });

    return this.userRepository.save(newOrganizer);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
}
