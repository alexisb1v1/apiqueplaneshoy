-- ==============================================================================
-- MIGRACIÓN DDL: TABLA shows - DURACIÓN EN HORAS ENTERAS (INTEGER) Y NOMBRE
-- Fecha: 2026-10-30
-- Plataforma: PostgreSQL 14+ / Qué Planes Hoy
-- ==============================================================================

BEGIN;

-- 1. Agregar columna 'name' (nombre descriptivo de la función) si no existe
ALTER TABLE "shows" 
  ADD COLUMN IF NOT EXISTS "name" varchar(150);

COMMENT ON COLUMN "shows"."name" IS 'Nombre o título descriptivo de la función (ej: Función Principal: Noche de Apertura)';

-- 2. Agregar columna 'duration_hours' (número entero de horas: 1, 2, 3, 4, 5)
ALTER TABLE "shows" 
  ADD COLUMN IF NOT EXISTS "duration_hours" integer DEFAULT 2;

COMMENT ON COLUMN "shows"."duration_hours" IS 'Duración estimada del evento en horas enteras (1, 2, 3, etc.)';

-- 3. Si existía la columna previa 'end_time' (timestamptz):
--    Migra las horas calculadas restando start_time y luego elimina la columna obsoleta.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'shows' AND column_name = 'end_time'
  ) THEN
    -- Convertir la diferencia temporal a horas enteras
    UPDATE "shows"
    SET "duration_hours" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("end_time" - "start_time")) / 3600)::integer)
    WHERE "end_time" IS NOT NULL 
      AND "start_time" IS NOT NULL 
      AND ("duration_hours" IS NULL OR "duration_hours" = 2);

    -- Eliminar la columna obsoleta end_time
    ALTER TABLE "shows" DROP COLUMN "end_time";
  END IF;
END $$;

-- 4. Asegurar que registros existentes sin valor tomen el valor por defecto (2 horas)
UPDATE "shows" 
SET "duration_hours" = 2 
WHERE "duration_hours" IS NULL;

COMMIT;

