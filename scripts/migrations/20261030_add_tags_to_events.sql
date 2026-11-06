-- =========================================================================
-- MIGRACIÓN: Agregar columna tags (text[]) a la tabla events
-- Base de datos: PostgreSQL
-- =========================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
          AND column_name = 'tags'
    ) THEN
        ALTER TABLE events ADD COLUMN tags text[] DEFAULT '{}';
        COMMENT ON COLUMN events.tags IS 'Etiquetas o tags de búsqueda del evento';
    END IF;
END $$;

