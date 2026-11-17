-- Migración: Agregar columna username a la tabla users y eliminar columna is_backoffice_user si existiese
-- Fecha: 2026-11-13

-- 1. Asegurar columna username
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username VARCHAR(100);

-- Para los usuarios ya registrados, su username inicial es su email en minúsculas
UPDATE users 
SET username = LOWER(email) 
WHERE username IS NULL;

-- Restricción NOT NULL y UNIQUE en username
ALTER TABLE users 
ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username ON users (LOWER(username));

COMMENT ON COLUMN users.username IS 'Nombre de usuario único utilizado para autenticación en la plataforma y backoffice';

-- 2. Eliminar columna is_backoffice_user en caso se haya creado
ALTER TABLE users 
DROP COLUMN IF EXISTS is_backoffice_user;
