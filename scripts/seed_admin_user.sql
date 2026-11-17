-- ============================================================================
-- Script: Inserción / Creación de Usuario Administrador para Backoffice
-- Base de Datos: PostgreSQL (apiqueplaneshoy)
-- ============================================================================
-- Credenciales generadas:
--   Usuario (username): abasilio
--   Email:              abasilio@queplaneshoy.com
--   Contraseña:         Admin123!*
--   Rol:                admin
--   Hash bcryptjs:      $2b$10$MdVDBNhLP7bFNz2475qXJOlyTOZUgC8bs0Zbh5QMnVx/tNcVFPzwu
-- ============================================================================

INSERT INTO users (
    name,
    email,
    username,
    password_hash,
    role,
    is_organizer,
    email_verified_at,
    created_at
)
VALUES (
    'Alexis Basilio',
    'abasilio@queplaneshoy.com',
    'abasilio',
    -- Hash bcrypt validado compatible con bcryptjs en NestJS ('Admin123!*')
    '$2b$10$MdVDBNhLP7bFNz2475qXJOlyTOZUgC8bs0Zbh5QMnVx/tNcVFPzwu',
    'admin',
    FALSE,
    NOW(),
    NOW()
)
ON CONFLICT (username) DO UPDATE
SET 
    role = 'admin',
    password_hash = EXCLUDED.password_hash,
    email_verified_at = COALESCE(users.email_verified_at, NOW()),
    name = EXCLUDED.name;

-- ============================================================================
-- Consulta de Verificación:
-- ============================================================================
-- SELECT id, public_uuid, name, email, username, role, email_verified_at, created_at 
-- FROM users 
-- WHERE username = 'abasilio';
