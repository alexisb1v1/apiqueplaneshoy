-- ==============================================================================
-- MIGRACIÓN DDL / ALTER SCRIPTS: ALINEACIÓN COMPLETA DE EVENTOS Y MODELO DE NEGOCIO
-- Fecha: 2026-10-30
-- Plataforma: PostgreSQL 14+ / NestJS CQRS (Qué Planes Hoy)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABLA: events
-- ------------------------------------------------------------------------------

-- Campo unificado de geolocalización (latitud, longitud) vía Leaflet/OpenStreetMap
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "coordinates" varchar(100);

-- Si existieran las columnas antiguas latitude y longitude, migrarlas de forma condicional
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'latitude'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'longitude'
  ) THEN
    EXECUTE 'UPDATE "events" SET "coordinates" = CONCAT("latitude", '', '', "longitude") WHERE "coordinates" IS NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL';
  END IF;
END $$;

-- Ubicación oficial INEI (reemplaza department/province/district)
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "ubigeo_code" varchar(6);

-- Enlace interactivo de Google Maps
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "google_maps_url" varchar(512);

-- Restricción de edad y control de acceso
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "age_restriction" varchar(50) DEFAULT 'GENERAL';

ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "user_ticket_limit" integer DEFAULT 4;

ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "entry_requirements" text;

ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "opening_hours_comment" text;

-- Términos y condiciones oficiales (únicamente por URL o documento PDF)
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "terms_and_conditions_url" varchar(512);

-- Preguntas frecuentes y configuración visual de Landing Page
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "faqs" jsonb;

ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "has_landing_page" boolean DEFAULT false;

ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "landing_config" jsonb;

-- Etiquetas de búsqueda
ALTER TABLE "events" 
  ADD COLUMN IF NOT EXISTS "tags" text[] DEFAULT '{}';

-- Limpieza de campos obsoletos en events (descartados en el diseño final)
ALTER TABLE "events" DROP COLUMN IF EXISTS "terms_and_conditions_text";
ALTER TABLE "events" DROP COLUMN IF EXISTS "department";
ALTER TABLE "events" DROP COLUMN IF EXISTS "province";
ALTER TABLE "events" DROP COLUMN IF EXISTS "district";

-- Nota: Si deseas conservar temporalmente latitude/longitude como backup, déjalas;
-- si prefieres eliminarlas de una vez, descomenta las dos siguientes líneas:
-- ALTER TABLE "events" DROP COLUMN IF EXISTS "latitude";
-- ALTER TABLE "events" DROP COLUMN IF EXISTS "longitude";


-- ------------------------------------------------------------------------------
-- 2. TABLA: shows (Funciones)
-- ------------------------------------------------------------------------------

ALTER TABLE "shows" 
  ADD COLUMN IF NOT EXISTS "name" varchar(150);

ALTER TABLE "shows" 
  ADD COLUMN IF NOT EXISTS "sales_end_at" timestamptz;

-- Duración estimada del show en horas enteras (reemplaza end_time)
ALTER TABLE "shows" 
  ADD COLUMN IF NOT EXISTS "duration_hours" integer DEFAULT 2;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shows' AND column_name = 'end_time'
  ) THEN
    UPDATE "shows"
    SET "duration_hours" = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ("end_time" - "start_time")) / 3600)::integer)
    WHERE "end_time" IS NOT NULL AND "start_time" IS NOT NULL AND ("duration_hours" IS NULL OR "duration_hours" = 2);

    ALTER TABLE "shows" DROP COLUMN "end_time";
  END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. TABLA: zones (Localidades)
-- ------------------------------------------------------------------------------

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "title" varchar(150);

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "color" varchar(20) DEFAULT '#3B82F6';

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "benefits" text;

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "service_fee" numeric(10,2) DEFAULT 0.00;

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "max_tickets_per_order" integer DEFAULT 6;

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "max_tickets_per_user" integer DEFAULT 10;

ALTER TABLE "zones" 
  ADD COLUMN IF NOT EXISTS "sales_start_at" timestamptz;


-- ------------------------------------------------------------------------------
-- 4. TABLA: zone_pricing_tiers (Preventas escalonadas: hasta 3 tiers por zona)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "zone_pricing_tiers" (
    "id" BIGSERIAL PRIMARY KEY,
    "public_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "zone_id" BIGINT NOT NULL REFERENCES "zones"("id") ON DELETE CASCADE,
    "tier_number" SMALLINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "price" NUMERIC(10,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "sold_count" INTEGER NOT NULL DEFAULT 0,
    "locked_count" INTEGER NOT NULL DEFAULT 0,
    "end_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "uq_zone_tier_number" UNIQUE ("zone_id", "tier_number")
);

CREATE INDEX IF NOT EXISTS "idx_zone_pricing_tiers_zone_id" ON "zone_pricing_tiers"("zone_id");


-- ------------------------------------------------------------------------------
-- 5. TABLA: coupons (Cupones de descuento con vigencia límite)
-- ------------------------------------------------------------------------------

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "starts_at" timestamptz;

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "usage_type" varchar(20) DEFAULT 'single_use';

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "max_uses" integer;

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "used_count" integer DEFAULT 0;

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "min_order_amount" numeric(10,2);

ALTER TABLE "coupons" 
  ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;


-- ------------------------------------------------------------------------------
-- 6. TABLA: event_images (Soporte para assets de Landing Page)
-- ------------------------------------------------------------------------------

-- Garantizar longitud suficiente para: banner, gallery, zone_map, landing_header, landing_body, landing_footer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_images' AND column_name = 'image_type'
  ) THEN
    EXECUTE 'ALTER TABLE "event_images" ALTER COLUMN "image_type" TYPE varchar(50)';
  END IF;
END $$;

COMMIT;

