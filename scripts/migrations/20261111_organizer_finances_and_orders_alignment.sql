-- ==============================================================================
-- MIGRACIÓN DDL: CUENTAS BANCARIAS DEL ORGANIZADOR, EVENT_ID EN ORDERS Y GATEWAY FEE
-- Fecha: 2026-11-11
-- Plataforma: PostgreSQL 14+ / NestJS CQRS (Qué Planes Hoy)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. NUEVA TABLA: organizer_bank_accounts (Cuentas bancarias para pagos/adelantos)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "organizer_bank_accounts" (
    "id" BIGSERIAL PRIMARY KEY,
    "public_uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "bank_name" VARCHAR(100) NOT NULL,
    "account_type" VARCHAR(30) NOT NULL DEFAULT 'checking',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'PEN',
    "account_number" VARCHAR(50) NOT NULL,
    "cci" VARCHAR(50),
    "holder_name" VARCHAR(150) NOT NULL,
    "holder_document_type" VARCHAR(20),
    "holder_document_number" VARCHAR(20),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_organizer_bank_accounts_public_uuid"
  ON "organizer_bank_accounts"("public_uuid");

CREATE INDEX IF NOT EXISTS "idx_organizer_bank_accounts_user_id"
  ON "organizer_bank_accounts"("user_id");

CREATE INDEX IF NOT EXISTS "idx_organizer_bank_accounts_default"
  ON "organizer_bank_accounts"("user_id", "is_default");

-- ------------------------------------------------------------------------------
-- 2. TABLA: orders -> Añadir columna event_id y hacer backfill seguro
-- ------------------------------------------------------------------------------

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "event_id" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'orders' AND constraint_name = 'fk_orders_event_id'
  ) THEN
    ALTER TABLE "orders"
      ADD CONSTRAINT "fk_orders_event_id"
      FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_orders_event_id"
  ON "orders"("event_id");

-- Backfill de event_id para órdenes históricas desde tickets -> shows
UPDATE "orders" o
SET "event_id" = sub."event_id"
FROM (
  SELECT DISTINCT ON (t."order_id")
    t."order_id",
    s."event_id"
  FROM "tickets" t
  INNER JOIN "shows" s ON s."id" = t."show_id"
  WHERE t."order_id" IS NOT NULL
  ORDER BY t."order_id", t."id" ASC
) sub
WHERE o."id" = sub."order_id"
  AND o."event_id" IS NULL;

-- ------------------------------------------------------------------------------
-- 3. TABLA: payments -> Añadir columna gateway_fee_amount
-- ------------------------------------------------------------------------------

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "gateway_fee_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

COMMIT;

-- ==============================================================================
-- NOTA IMPORTANTE DE PERMISOS (SI SE EJECUTA COMO 'postgres' / SUPERUSUARIO):
-- Concede permisos sobre la nueva tabla y secuencia al usuario de la API (DB_USER):
--
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizer_bank_accounts" TO "<DB_USER>";
-- GRANT USAGE, SELECT ON SEQUENCE "organizer_bank_accounts_id_seq" TO "<DB_USER>";
--
-- Si tu entorno local mantiene DB_SYNCHRONIZE=true, asigna también el ownership:
-- ALTER TABLE "organizer_bank_accounts" OWNER TO "<DB_USER>";
-- ==============================================================================


