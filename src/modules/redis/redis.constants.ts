export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Jerarquía de claves de Redis estructuradas por carpetas y secciones.
 * Convención estándar en Redis para visualización jerárquica en carpetas (Redis Insight / GUI):
 * 
 * qph
 *  └── home
 *       ├── hero            (Eventos destacados del Hero Carousel - TTL 12h)
 *       ├── upcoming        (Próximos eventos cronológicos - TTL 15m)
 *       ├── weekly_featured (Eventos destacados de la semana - TTL 15m)
 *       └── weekend         (Planes para el fin de semana - TTL 15m)
 */
export const REDIS_CACHE_KEYS = {
  HOME: {
    HERO: 'qph:home:hero',
    UPCOMING: 'qph:home:upcoming',
    WEEKLY_FEATURED: 'qph:home:weekly_featured',
    WEEKEND: 'qph:home:weekend',
  },
  EVENTS: {
    LANDING: (slug: string) => `qph:events:landing:${slug}` as const,
    DETAIL: (identifier: string) => `qph:events:detail:${identifier}` as const,
  },
  // Clave canónica de eventos destacados en el Hero de la Home
  FEATURED_EVENTS: 'qph:home:hero',
} as const;

export const REDIS_DEFAULT_TTL = {
  FEATURED_EVENTS_SECONDS: 12 * 60 * 60, // 12 horas = 43,200 segundos
  HOME_SECTIONS_SECONDS: 15 * 60,        // 15 minutos = 900 segundos
  EVENT_LANDING_SECONDS: 15 * 60,        // 15 minutos = 900 segundos
  EVENT_DETAIL_SECONDS: 15 * 60,         // 15 minutos = 900 segundos
} as const;
