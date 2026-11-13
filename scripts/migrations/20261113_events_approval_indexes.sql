-- ============================================================================
-- Migración: Optimización de Índices GIN y B-Tree para Moderación de Eventos
-- Base de Datos: PostgreSQL (apiqueplaneshoy)
-- Fecha: 2026-11-13
-- ============================================================================

-- 1. Habilitar extensión de trigramas si no existe (estándar nativa de PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Índice GIN sobre el nombre del evento para búsqueda instantánea en Backoffice
CREATE INDEX IF NOT EXISTS idx_events_name_gin_trgm 
ON events USING gin (LOWER(name) gin_trgm_ops);

-- 3. Índice GIN sobre el recinto / venue para búsqueda instantánea
CREATE INDEX IF NOT EXISTS idx_events_venue_gin_trgm 
ON events USING gin (LOWER(venue) gin_trgm_ops) 
WHERE venue IS NOT NULL;

-- 4. Índice compuesto B-Tree para paginación rápida por estado cronológico
CREATE INDEX IF NOT EXISTS idx_events_status_created_at 
ON events (status, created_at DESC);

-- 5. Índice compuesto para shows ordenados por inicio (acelera MIN(start_time))
CREATE INDEX IF NOT EXISTS idx_shows_event_start_time 
ON shows (event_id, start_time ASC);

-- 6. Índice en zonas por evento (acelera la agregación de aforos y precios)
CREATE INDEX IF NOT EXISTS idx_zones_event_id 
ON zones (event_id);
