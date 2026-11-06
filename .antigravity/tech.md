# Guía Técnica: "Qué planes hoy"

## Stack Tecnológico

### Frontend (`queplaneshoy`)
- **Framework:** Next.js (React)
- **Lenguaje:** TypeScript
- **Estilos:** Vanilla CSS / Tailwind CSS (según configuración elegida)
- **Arquitectura Sugerida:** Clean Architecture adaptada para Next.js (separación estricta entre UI, Casos de Uso y Repositorios).

### Backend (`apiqueplaneshoy`)
- **Framework:** NestJS
- **Lenguaje:** TypeScript
- **Base de Datos:** PostgreSQL/MongoDB (a definir) + TypeORM/Mongoose/Prisma
- **Arquitectura Sugerida:** Clean Architecture (4 capas), DDD y CQRS. Manejo funcional de errores con `neverthrow`.

### Infraestructura y DevOps
- **Contenedores:** Docker y Docker Compose (`docker-compose.yml` y `docker-compose.dev.yml` disponibles).
- **CI/CD:** GitHub Actions (configuración en `.github`).
- **Control de Versiones:** Git Flow o Trunk-based development.

## Entorno de Desarrollo (Local)

### Requisitos Previos
- Node.js (v18 o superior)
- Docker y Docker Compose
- Gestor de paquetes: `npm` o `pnpm`

### Levantar el Entorno
1. **Variables de Entorno:**
   - Backend: Copiar `.env.template` a `.env` y configurar credenciales locales.
   - Frontend: Configurar variables necesarias en `.env.local`.
2. **Ejecución vía npm (Desarrollo):**
   - Backend: `npm install` -> `npm run start:dev`
   - Frontend: `npm install` -> `npm run dev`
3. **Ejecución vía Docker:**
   - Backend: `docker-compose -f docker-compose.dev.yml up -d` para levantar servicios como la base de datos de manera aislada.

## Estándares y Convenciones
- **Idiomas:** Seguir siempre las reglas globales y configuraciones (Skill "preferencia-idioma-espanol" activo).
- **Control de errores:** Uso de patrones de Result y helpers como `matchResult`.
- **Testing:** Pruebas unitarias indispensables para los casos de uso principales.

## Próximos Pasos Técnicos
- [ ] Definir el esquema de la base de datos (Entidades: `Usuario`, `Plan`, `Categoria`).
- [ ] Configurar la base de datos en el docker-compose y conectar el ORM en NestJS.
- [ ] Establecer el flujo de Autenticación (JWT, OAuth) entre Frontend y Backend.
