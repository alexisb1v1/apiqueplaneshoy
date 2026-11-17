-- Migración idempotente: Soporte para comisión incluida en zonas, video promocional y redes sociales del evento
-- Fecha: 2026-11-12

ALTER TABLE zones
  ADD COLUMN IF NOT EXISTS fee_included BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS promo_video_url VARCHAR(512) NULL,
  ADD COLUMN IF NOT EXISTS social_links JSONB NULL;

