-- Migración: Agregar columna observation_reason a events
-- Fecha: 2026-11-13

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS observation_reason TEXT;

COMMENT ON COLUMN events.observation_reason IS 'Motivo o detalle de observación del evento registrado por la administración en el Backoffice';

