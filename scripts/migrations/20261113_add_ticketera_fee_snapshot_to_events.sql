-- Migración: Agregar columna ticketera_fee_snapshot a events
-- Fecha: 2026-11-13

ALTER TABLE events 
ADD COLUMN IF NOT EXISTS ticketera_fee_snapshot JSONB;

COMMENT ON COLUMN events.ticketera_fee_snapshot IS 'Snapshot inmutable de comisiones y tarifas pactadas por zona congeladas al momento de aprobar el evento (published)';

