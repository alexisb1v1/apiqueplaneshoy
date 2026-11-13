# Flujos de Negocio y Arquitectura de Procesos - "Qué planes hoy"

Este documento describe los flujos de negocio fundamentales de la plataforma, detallando la interacción entre el **Frontend Web**, la **App de Puerta (Escáner)**, el **Backend NestJS (CQRS)**, la **Base de Datos PostgreSQL** y las **Pasarelas de Pago Externas**.

---

## 1. Mapa General de Flujos

```mermaid
graph TD
    U["0. Registro y Extensión de Perfil (Promotor/Comprador)"] -->|"Cuenta Activa"| B["2. Venta, Cupones y Checkout de Entradas"]
    U -->|"Activa Perfil Promotor"| A["1. Creación de Eventos, Preventas y Cupones"]
    A -->|"Publicación"| B
    B -->|"Emisión de QR con Firma Digital Ed25519"| C["3. Validación de Accesos en Puerta (App Escáner)"]
    B -->|"Recaudación Neta Custodiada"| D["4. Ciclo Financiero: Anticipos y Liquidación Final"]
```

---

## 2. Flujo 0: Registro, Autenticación y Extensión de Perfil (Comprador y Organizador)

Garantiza que una misma persona pueda comprar entradas como cliente final y, cuando lo desee, activar su perfil de promotor para gestionar espectáculos sin registrar cuentas duplicadas.

### 2.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario Único
    participant Web as Web Clientes / Promotores (Next.js)
    participant OAuth as Proveedor OAuth (Google/Facebook)
    participant API as Backend NestJS
    participant DB as PostgreSQL
    participant Mail as Servicio de Email (SMTP/Resend)

    alt Camino A: Autenticación con Google OAuth 2.0
        Usuario->>Web: Clic en "Continuar con Google"
        Web->>API: GET /api/auth/google/url?redirect=...
        API-->>Web: { url } (con state CSRF almacenado en Redis TTL 10 min)
        Web->>OAuth: Redirige a consentimiento OAuth de Google
        OAuth-->>Web: Redirige a /auth/google/callback?code=...&state=...
        Web->>API: POST /api/auth/google/callback { code, state }
        API->>OAuth: Intercambia code y consulta perfil verificado de Google
        API->>DB: Valida social_identities o users.email como llave única
        opt Usuario nuevo
            API->>DB: INSERT INTO users (email, email_verified_at=NOW(), password_hash=NULL, role='customer', is_organizer=false)
        end
        API->>DB: Vincula/asegura registro en social_identities (provider='google', provider_id=sub)
        API-->>Web: 200 OK { token, user, redirectTo } + Cookie HttpOnly refresh_token
        Web-->>Usuario: Sesión iniciada y cuenta 100% activa
    else Camino B: Registro Tradicional (Formulario con Correo y Contraseña)
        Usuario->>Web: Ingresa Nombre, Correo y Contraseña
        Web->>API: POST /api/auth/register { name, email, password }
        activate API
        API->>DB: INSERT INTO users (email, password_hash=bcrypt, email_verified_at=NULL, is_organizer=false)
        API->>Mail: Envía correo con Token de Verificación (enlace de 6 dígitos)
        API-->>Web: 201 Created { message: 'Cuenta creada. Revisa tu correo.' }
        deactivate API

        Usuario->>Mail: Abre correo y hace clic en "Confirmar Cuenta"
        Mail->>Web: Redirige a /verify-email?token=xyz
        Web->>API: POST /api/auth/verify-email { token }
        API->>DB: UPDATE users SET email_verified_at = NOW()
        API-->>Web: 200 OK { message: 'Correo verificado exitosamente' }
        Web-->>Usuario: Cuenta habilitada para comprar boletos
    end

    opt Extensión Opcional: Activación de Perfil Organizador
        Usuario->>Web: Clic en "Crear Evento / Soy Organizador"
        Web->>Usuario: Formulario KYC (Razón Social/Nombre, DNI/RUC, Teléfono, Logo)
        Usuario->>Web: Envía datos comerciales
        Web->>API: POST /api/auth/become-organizer { organizerName, organizerDocumentType, organizerDocumentNumber, organizerPhone, organizerLogoUrl }
        API->>DB: UPDATE users SET is_organizer = true, organizer_name = :name, organizer_phone = :phone ...
        API-->>Web: 200 OK { token, user: { isOrganizer: true, organizerName, ... } }
        Web-->>Usuario: Acceso desbloqueado al Dashboard de Promotor con nuevo JWT (sin cerrar sesión)
    end
```

### 2.2 Reglas de Negocio y Endpoints de Autenticación:
* **Endpoints Oficiales de Auth:**
  * `POST /api/auth/register`: Registro tradicional con hashing bcrypt, emisión de token criptográfico de verificación (24h), Access Token (15m) y Refresh Token rotativo en Redis (30d).
  * `POST /api/auth/login`: Autenticación con email/password y retorno de Access Token JWT (15m), Refresh Token rotativo en Redis (30d) y perfil de usuario `{ id, email, role, isOrganizer }`.
  * `GET /api/auth/google/url`: Genera URL OAuth 2.0 de Google con token `state` anti-CSRF almacenado en Redis (TTL 10 min).
  * `POST /api/auth/google/callback`: Intercambia el código recibido en `/auth/google/callback`, valida `state` de un solo uso, busca o vincula el usuario usando `users.email` como llave única en `social_identities` y emite JWT + Refresh Token en Cookie `HttpOnly`.
  * `POST /api/auth/refresh-token`: Renovación de tokens sin fricción. Valida el token contra Redis (`qph:auth:refresh:<userId>:<uuid>`) recibido automáticamente vía Cookie `HttpOnly` (o fallback en body), aplica rotación destruyendo el anterior, emite un nuevo par de tokens y actualiza la cookie.
  * `POST /api/auth/logout`: Cierre de sesión seguro. Invalida y elimina la Cookie `HttpOnly` (`Max-Age=0`).
  * `POST /api/auth/verify-email`: Confirmación de correo mediante token seguro. Actualiza `users.email_verified_at = NOW()`.
  * `POST /api/auth/resend-verification`: Reenvío de enlace de verificación con protección contra spam.
  * `GET /api/auth/me`: Retorna los datos normalizados del usuario autenticado (`AuthUserDto`).
  * `PUT /api/auth/profile`: Actualización de datos de perfil (`name`, `phone`).
  * `POST /api/auth/become-organizer`: Activación de perfil de organizador para cuentas unificadas.
* **Esquema de Autenticación Dual, Cookie HttpOnly y Token Rotation:**
  * El **Access Token** tiene una vigencia corta de **15 minutos** para mitigar riesgos de filtración o robo.
  * El **Refresh Token** se gestiona en **Redis** con un TTL de **30 días** y se transporta exclusivamente mediante **Cookie `HttpOnly; SameSite=Lax; Path=/`** (con bandera `Secure` en producción). Esto previene al 100% el robo por ataques XSS en el navegador, ya que el JavaScript no puede acceder al token.
  * Cada vez que se usa para renovar la sesión en `POST /api/auth/refresh-token`, se destruye atómicamente el token anterior en Redis y se genera uno nuevo (*Token Rotation*), invalidando cualquier token reutilizado maliciosamente y actualizando la cookie en el navegador.
  * El cliente HTTP del frontend (`apiClient`) intercepta de forma transparente los códigos `401 Unauthorized`, envía las credenciales mediante `credentials: 'include'` en segundo plano mediante un mutex que sincroniza peticiones concurrentes y reintenta la solicitud sin interrumpir al usuario.
* **Protección Estricta del Checkout / Compra con JWT:**
  * Toda compra en `POST /api/orders/simulate-checkout` requiere obligatoriamente que el comprador tenga una sesión JWT válida (`401 Unauthorized` si no existe). No se admiten compras anónimas o sin cuenta.
  * En el frontend (`purchase-flow-page.tsx`), antes de avanzar al paso de pago o al confirmar la transacción, se verifica la sesión activa. Si el usuario no ha iniciado sesión, se despliega un modal interactivo con redirección preservando las entradas seleccionadas.
* **Protección Anti-Abuso y Rate Limiting Distribuido (Redis + Throttler):**
  * Todas las rutas públicas y de consulta están protegidas por un Rate Limiter distribuido en Redis (`ThrottlerStorageRedisService`) con cuota de 60 peticiones/minuto por IP. Las solicitudes excedentes reciben `429 Too Many Requests`.
* **Protección de Endpoints Administrativos:**
  * Endpoints como `POST /api/events/admin/seed` y `POST /api/events/admin/sync-expired-status` están protegidos mediante el guard `AdminKeyGuard`, requiriendo el encabezado `x-admin-key` o sesión de usuario con rol `admin`.
* **Verificación de Email Obligatoria (Plan B):** Un usuario con `email_verified_at IS NULL` puede registrar eventos como borrador (`draft`), pero no puede avanzar al checkout de compra ni publicar eventos (`published`).
* **Sesión Única:** El mismo JWT autentica al usuario tanto en la tienda de boletos como en el panel administrativo de promotor.

---

## 3. Flujo 1: Creación de Eventos, Preventas Escalonadas, Cupones y Personalización

Permite al promotor configurar integralmente su evento: ficha técnica, restricción de edad, términos y condiciones (en texto y/o enlace PDF oficial), preguntas frecuentes (FAQs), landing page con croquis de zonas, funciones de shows, precios regulares, hasta 3 preventas escalonadas y cupones de descuento.

### 3.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Org as Promotor (is_organizer=true)
    participant Web as Panel Web Promotor (Next.js)
    participant API as Backend NestJS (CQRS)
    participant Crypto as Módulo Criptográfico (Ed25519)
    participant DB as PostgreSQL (Transacción Atómica)

    Org->>Web: Completa el Asistente de Creación en 6 Secciones
    Note over Org,Web: 1. Ficha General (Nombre, Categoría oficial EVENT_CATEGORIES, Tags de búsqueda text[], Ubigeo INEI 6 dígitos, Recinto, Coordenadas lat/lng vía Mapa Leaflet, Restricción de edad AGE_RESTRICTIONS, Límite entradas usuario, Requisitos acceso, Horarios informativos)<br/>2. Legal y Contenido (Términos URL PDF, FAQs, Landing config con selección de fondo por color sólido o patrón en mosaico repeat: header, body, footer, theme)<br/>3. Shows (nombre, start_time fecha y hora, sales_end_at hora de cierre de ventas, duration_hours en horas enteras)<br/>4. Zonas (Badge con color HEX, nombre, título comercial resaltado, beneficios, aforo, regular_price S/., comisión service_fee, max_tickets_per_order, sales_start_at)<br/>   + Hasta 3 Preventas por zona (zone_pricing_tiers: tier_number, price, capacity, end_at)<br/>5. Cupones (code, discount_type % o S/., discount_value, usage_type, max_uses, expires_at)<br/>6. Multimedia (carga directa de imágenes para portada, galería, croquis y landing)
    
    Web->>API: POST /api/events (CreateEventCommand Payload)
    activate API
    API->>API: Valida coherencia (fechas shows, cupo preventas <= aforo zona, precios preventa < regular_price)
    API->>Crypto: Genera par de llaves Ed25519 exclusivo para este evento
    Crypto-->>API: { signing_key_id, signing_public_key, private_key }
    
    API->>DB: Inicia Transacción Atómica
    DB->>DB: INSERT INTO events (organizer_id, category, tags, age_restriction, terms_and_conditions_url, faqs, landing_config, ubigeo_code, coordinates, google_maps_url, user_ticket_limit, entry_requirements, opening_hours_comment, signing_key_id, signing_public_key, status='draft')
    DB->>DB: INSERT INTO shows (event_id, name, start_time, sales_end_at, duration_hours)
    DB->>DB: INSERT INTO zones (event_id, name, title, color, capacity, regular_price, service_fee, benefits, max_tickets_per_order, sales_start_at)
    DB->>DB: INSERT INTO zone_pricing_tiers (zone_id, tier_number, name, price, capacity, end_at)
    opt Cupones iniciales configurados
        DB->>DB: INSERT INTO coupons (event_id, organizer_id, code, discount_type, discount_value, usage_type, max_uses, expires_at)
    end
    DB->>DB: INSERT INTO event_images (image_type='banner'|'gallery'|'zone_map')
    DB-->>API: Commit Transacción (public_uuid generado)
    deactivate API
    
    API-->>Web: 201 Created { event_public_uuid, status: 'draft' }
    Web-->>Org: Redirige a Vista Previa del Evento y Dashboard de Gestión
```

### 3.2 Reglas de Negocio en la Configuración:
* **Precio Regular de la Zona (`zones.regular_price`):** Es la tarifa de lista oficial en Soles (S/.) y permanece perenne. En las tarjetas de zonas, el nombre del sector se presenta en un **badge con el color HEX** configurado y el título comercial de la zona se resalta visualmente con sus beneficios.
* **Escala Oficial Automatizada de Comisión QuePlanesHoy:**
  - **Hasta S/ 50.00:** S/ 6.00 fijos por entrada.
  - **De S/ 51.00 a S/ 125.00:** S/ 10.00 fijos por entrada.
  - **A partir de S/ 126.00:** 8% del precio por entrada (`Math.round(precio * 0.08 * 100) / 100`).
  - **Tarifa Final:** Visualización dinámica en drawer que recalcula el importe final al público según la inclusión o no de la comisión.
  - **Modal Informativo de Tarifario:** Ventana explicativa disponible en el asistente de creación de zonas.
  - **Ocultamiento del Input en Creación:** El promotor no edita la comisión; en el drawer de zonas solo ingresa Aforo y Precio Regular.
  - **Modal de Etapa de Aprobación & Liquidación:** Al pulsar "Publicar Evento", se abre un modal de aprobación donde se desglosan oficialmente las zonas, el precio al comprador, la comisión oficial calculada y la recaudación neta estimada que recibirá el promotor antes de dar el pase a producción.
  - **Modalidad de Comisión (`zones.fee_included`):** Si está activado, la comisión oficial se descuenta del monto a liquidar al promotor; si está desactivado, la comisión se suma al precio final que abona el comprador.
* **Preventas Escalonadas (`zone_pricing_tiers`):** Hasta 3 preventas por zona ordenadas por `tier_number ASC`. El precio promocional debe ser estrictamente menor que `regular_price` y la suma de cupos de preventa no puede exceder el `capacity` total de la zona.
* **Shows y Funciones (`shows`):** Cada función se lista a razón de 1 por fila con un cuadro de calendario (`OCT 15`), hora de inicio, solo hora de cierre de venta de boletos, duración estimada del show en horas enteras (`duration_hours`), aforo asignado y opción de duplicar show con 1 clic.
* **Multimedia, Galería Oficial y Cloudflare R2:** Organización en 2 filas visuales:
  - **Fila 1:** Banner Principal (1920x800) y Croquis de Zonas (Plano del Recinto) en dos columnas.
  - **Fila 2:** Galería de Fotos Oficiales con cuadrícula de 4 slots y **regla estricta de máximo 4 fotos oficiales** (`event_images` con `image_type='gallery'`).
  - **Arquitectura de Subida Directa:** Las imágenes se cargan directamente a **Cloudflare R2** mediante URLs prefirmadas temporales de 5 minutos generadas por el endpoint `POST /api/media/presigned-url`, eliminando el consumo de memoria RAM y ancho de banda del servidor VPS. Se organizan automáticamente por prefijos (`banners/`, `croquis/`, `gallery/`, `landings/`).
* **Categorías y Restricciones Canónicas (`eventConstants.ts`):** Todo evento se clasifica mediante el catálogo unificado `EVENT_CATEGORIES` (`CONCERTS`, `THEATER`, `SPORTS`, `FESTIVALS`, `COMEDY`, `GASTRONOMY`) y su restricción de edad mediante `AGE_RESTRICTIONS` (`ALL_AGES`, `PLUS_14`, `PLUS_18`), facilitando el filtrado en cartelera y consistencia de badges e iconos emoji.
* **Etiquetas de Búsqueda (`events.tags text[]`):** Arreglo de palabras clave administradas desde un control interactivo (con inserción mediante Enter/coma, chips de borrado y sugerencias rápidas) para optimizar el motor de indexación y búsqueda.
* **Landing Page Dedicada, Fondo Personalizado y Live Preview:** Diseño modular y compacto que permite elegir entre un **color de fondo sólido** (`backgroundColor`) o una **imagen pequeña en mosaico** (`backgroundPatternUrl` con repetición `repeat`). Incluye un simulador interactivo en tiempo real (*Live Mini-Preview*) que refleja fielmente el fondo, Hero, 3 atractivos del Body y Footer.
* **Modales Drawer Laterales:** Todos los formularios secundarios (agregar/editar shows, zonas y cupones) se despliegan en paneles laterales (*Drawer*) a pantalla completa vertical en el margen derecho, optimizando la concentración del usuario y el espacio de trabajo.
* **Cupones de Descuento:** Selector de vigencia con campos separados de Fecha (`dd/mm/aaaa`) y Hora (`hh:mm`), previniendo desajustes de hidratación SSR y confusiones de zona horaria.
* **Geolocalización Normalizada:** El distrito se resuelve con el código de 6 dígitos `ubigeo_code` (INEI) y las coordenadas geográficas se almacenan en un único campo `coordinates` (`latitud, longitud`) capturado con el selector de mapa OpenStreetMap / Leaflet.
* **Términos y Condiciones:** Se gestiona exclusivamente mediante enlace web o documento PDF oficial (`terms_and_conditions_url`).
* **Control de Boletos:** Se valida `zones.max_tickets_per_order` (máximo por orden en esa zona) y `events.user_ticket_limit` (límite acumulado por usuario en todo el evento).

### 3.3 Publicación de Eventos y Regla de Oro del Plan B (Email Verification Gate)

Permite al promotor crear y guardar borradores de sus eventos sin ninguna barrera de verificación previa. Sin embargo, para activar la venta pública de entradas y publicar el evento en la cartelera oficial, el sistema aplica una validación criptográfica estricta de correo.

```mermaid
sequenceDiagram
    autonumber
    actor Org as Organizador / Promotor
    participant Web as Web Promotor (Next.js)
    participant Local as Almacenamiento Local (qph_event_draft)
    participant API as Backend NestJS (CQRS)
    participant DB as PostgreSQL

    Note over Org,Web: Acceso Público Libre a /organizer/events/new (Lazy Authentication)
    Org->>Web: Configura título, funciones, aforos y precios
    
    alt Caso 1: Guardar Borrador (status = 'draft')
        Org->>Web: Clic en "Guardar Borrador"
        opt Usuario sin sesión
            Web->>Local: Guarda borrador en localStorage
            Web->>Org: Modal: "Inicia sesión para persistir tu evento"
        end
        Web->>API: POST /api/events (Bearer Token)
        API->>DB: INSERT INTO events (status = 'draft', organizer_id = req.user.id)
        API-->>Web: 201 Created { id, slug, status: 'draft' }
        Web-->>Org: Notificación: "Borrador guardado exitosamente"

    else Caso 2: Publicar Evento (status = 'published')
        Org->>Web: Clic en "Publicar Evento Ahora"
        Web->>API: POST /api/events/:id/publish (Bearer Token)
        activate API
        API->>DB: SELECT id, email_verified_at, role FROM users WHERE id = req.user.id
        
        alt Correo NO verificado (email_verified_at IS NULL)
            API-->>Web: 403 Forbidden { code: 'EMAIL_NOT_VERIFIED', message: 'Debes confirmar tu correo...' }
            deactivate API
            Web->>Org: Modal Plan B: "Tu evento está guardado como borrador.<br/>Confirma tu correo para ponerlo a la venta." + [Reenviar Correo]
        else Correo SÍ verificado (email_verified_at NOT NULL)
            activate API
            API->>DB: UPDATE events SET status = 'published' WHERE id = :id AND organizer_id = req.user.id
            API-->>Web: 200 OK { id, status: 'published' }
            deactivate API
            Web-->>Org: Toast: "¡Evento publicado en vivo exitosamente!"
        end
    end
```

* **Control de Autorización (BOLA / OWASP API1):** El endpoint `/api/events/:id/publish` valida que el `organizer_id` del evento coincida obligatoriamente con el usuario autenticado en el token JWT (o rol `admin`).
* **Edición y Actualización de Borradores (`GET /api/events/organizer/:identifier/edit` y `PUT /api/events/:id`):**
  * `GET /api/events/organizer/:identifier/edit`: Retorna la estructura editable completa del evento (ficha, ubicación, shows, zonas con pricing tiers, cupones, imágenes de galería, FAQs y landing page), permitiendo a los promotores recuperar borradores pendientes incluso cuando `status = 'draft'`. Protegido estrictamente con `JwtAuthGuard` y validación de propiedad (*Ownership Check*).
  * `PUT /api/events/:id`: Endpoint atómico para actualizar la información del evento, sincronizar funciones de shows, reemplazar zonas y preventas escalonadas, actualizar cupones e imágenes, e invalidar de forma automática las claves de caché de Redis asociadas (`qph:events:detail:*`, `qph:events:landing:*`, `qph:home:*`).
  * En el frontend, el acceso se realiza a través de la ruta dinámica `/organizer/events/[id]/edit`, vinculada al botón **"Editar Borrador"** de la lista de eventos (`/organizer/events`).
* **Experiencia de Usuario (Lazy Authentication):** La ruta `/organizer/events/new` no fuerza redirecciones inmediatas al login, permitiendo a visitantes anónimos probar el creador de espectáculos y asegurando los datos en `localStorage` antes de solicitar el inicio de sesión.

---

## 4. Flujo 2: Compra, Validación de Cupones, Control de Concurrencia y Checkout

Controla la alta concurrencia mediante doble ventana temporal (10 min en backend vs 5 min en pasarela), valida límites de compra por checkout y por usuario, aplica cupones de descuento y emite tickets firmados criptográficamente.

### 4.0 Enrutamiento Contextual y Entrada al Checkout (Triada de Navegación Segura Anti-IDOR)
1. **Cartelera Principal / Home:**
   * Si `hasLandingPage = true && slug` $\rightarrow$ Redirige a la landing page dedicada `/e/[slug]`.
   * De lo contrario $\rightarrow$ Redirige a la ficha técnica oficial con UUID público opaco `/events/[publicUuid]`, erradicando el tanteo por ID numérico correlativo (OWASP BOLA / IDOR).
2. **Landing Page Dedicada (`/e/[slug]`):**
   * Disposición panorámica full-width. Al hacer clic en *"Comprar"* en cualquier localidad, envía directamente a `/checkout?eventId=[publicUuid]&zoneId=[zoneId]`.
3. **Ficha Técnica Oficial (`/events/[publicUuid]`):**
   * Carga dinámica de datos oficiales mediante `GET /events/:identifier` apoyada en caché Redis `qph:events:detail:{identifier}` (15 min). Acepta `publicUuid` o `slug`.
   * Al seleccionar una zona o pulsar *"Comprar Entradas"*, deriva a `/checkout?eventId=[publicUuid]` con la zona seleccionada.
4. **Checkout Inteligente (`/checkout`):**
   * Lee `searchParams` (`eventId`, `zoneId`), donde `eventId` es el `publicUuid` seguro del evento. Autoselecciona la primera función disponible y preselecciona 1 entrada (`quantity = 1`) en la zona indicada en `zoneId`.
   * **Autenticación Obligatoria:** Para avanzar al paso de pago o confirmar la compra, se valida que el comprador cuente con sesión activa (JWT). Si no la tiene, se despliega el modal interactivo de autenticación que preserva las entradas seleccionadas y vincula la orden a su cuenta.
   * **Pasarela Real Culqi Checkout Custom (`/api/orders/culqi/*` y `/api/webhooks/culqi`):**
     * `POST /api/orders/culqi/prepare` (JWT): reserva atómicamente tickets en estado `locked`, bloquea zonas/preventas (`FOR UPDATE`), evalúa cupón sin quemarlo aún, crea orden `pending` con `expires_at` configurable (`CULQI_ORDER_EXPIRATION_SECONDS`, default 900s) y genera la orden en Culqi API v2 (`POST /v2/orders`) con `metadata` auditable (`qph_order_id`, `qph_order_uuid`, `qph_user_id`, `qph_user_uuid`, `qph_user_email`) habilitando **Yape / Billeteras QR / Tarjetas / Banca Móvil y Agentes (PagoEfectivo CIP) / Cuotéalo BCP** dentro de **Culqi Checkout Custom** (`https://js.culqi.com/checkout-js`).
     * `POST /api/orders/culqi/confirm-charge` (JWT + BOLA): ejecuta `POST /v2/charges` con `CULQI_SECRET_KEY` enviando `antifraud_details` y `metadata` de trazabilidad completa (`qph_order_id`, `qph_order_uuid`, `qph_user_id`, `qph_user_uuid`, `qph_user_email`, `culqi_order_id`), soporta desafío **3D Secure (`REQUIRES_3DS` -> `Culqi3DS.initAuthentication` -> reenvío con `authentication_3DS`)**, quema el cupón atómicamente (`FOR UPDATE`) y emite tickets `sold` + código QR vía `OrderLifecycleService.finalizePaidOrder` (idempotente).
     * `GET /api/orders/culqi/status/:orderPublicUuid` (JWT + BOLA): consulta activa contra `GET /v2/orders/:id` para pagos asíncronos (QR Billeteras, PagoEfectivo CIP, Cuotéalo) mientras el frontend realiza polling cada 3s.
     * `POST /api/orders/culqi/cancel/:orderPublicUuid` (JWT + BOLA): libera el stock bloqueado cuando el usuario cierra el modal de Culqi sin pagar (validando antes que no se haya pagado en Culqi).
     * `POST /api/webhooks/culqi`: endpoint servidor-a-servidor protegido por Basic Auth (`CULQI_WEBHOOK_USERNAME`/`CULQI_WEBHOOK_PASSWORD`), deduplicación en Redis (`qph:webhook:culqi:*`), verificación activa contra Culqi API v2 (`GET /v2/orders/:id` o `GET /v2/charges/:id`) y finalización idempotente.
     * `OrderExpirationCronService`: audita cada minuto órdenes `pending` vencidas (`expires_at < NOW()`), verifica estado real en Culqi y libera stock `locked` en zonas y tiers.
   * **Simulación de Pasarela (`POST /api/orders/simulate-checkout`):** Se mantiene disponible para pruebas internas de carga con `k6`.

### 4.1 La Doble Ventana de Tiempos
* **15 Minutos (`14:59` en Checkout + `CULQI_ORDER_EXPIRATION_SECONDS=900`):** Ventana persistente en `sessionStorage` del navegador (resiste recargas F5 y redirección de login) acompañada del bloqueo temporal `locked` en PostgreSQL y liberación automática cada 60s vía `OrderExpirationCronService`.
* **Reintento tras Rechazo Bancario:** Si una tarjeta es rechazada en `/confirm-charge`, los tickets permanecen reservados (`pending`/`locked`) hasta la expiración, permitiendo reintentar con otro medio de pago (Yape, otra tarjeta o PagoEfectivo).

```mermaid
flowchart TD
    subgraph Frontend["1. Frontend (Navegador Comprador)"]
        F1["Inicio en Checkout (/checkout)"] --> F2["Cronómetro 15:00 min (sessionStorage)"]
        F2 -->|"Paso 1 y 2"| F3["Selección de entradas y datos de compra"]
        F3 -->|"Paso 3"| F4["Apertura Modal Culqi Checkout Custom"]
    end

    subgraph Backend["2. Backend NestJS & PostgreSQL (Reserva Atómica)"]
        B1["POST /api/orders/culqi/prepare"] --> B2["Bloqueo atómico: SELECT ... FOR UPDATE"]
        B2 --> B3["Crea orden: status='pending', expires_at = NOW() + 15 min (900s)"]
        B3 --> B4["Tickets reservados: status='locked', locked_until = NOW() + 15 min"]
    end

    subgraph CulqiGateway["3. Pasarela Culqi API v2"]
        C1["POST /v2/orders (Culqi Order)"] --> C2["Ventana de Pago: Tarjetas / Yape QR / PagoEfectivo CIP"]
    end

    subgraph WorkerCron["4. Worker de Expiración (OrderExpirationCronService)"]
        W1["Ejecución periódica cada 60 segundos"] --> W2{"¿Orden pendiente con expires_at < NOW()?"}
        W2 -->|"Sí y no pagada en Culqi"| W3["Transacción atómica de expiración"]
        W3 --> W4["orders.status = 'expired'<br/>zones.locked_count -= qty<br/>tiers.locked_count -= qty<br/>tickets.status = 'available'"]
        W4 --> W5["Stock recuperado y disponible nuevamente en cartelera"]
        W2 -->|"No vencida o pagada"| W6["Continúa auditoría periódica"]
    end

    F4 --> B1
    B3 --> C1
    F4 -.->|"Cierre manual sin pagar"| B5["POST /api/orders/culqi/cancel/:uuid ➔ Libera stock inmediato"]
    C2 -.->|"Si vence ventana de 15 min"| W1
```

### 4.2 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Comprador
    participant Web as Web Clientes (Next.js)
    participant API as Backend NestJS
    participant DB as PostgreSQL
    participant Culqi as Pasarela Culqi (API v2 / Culqi Checkout)

    Cliente->>Web: Selecciona Zona y Cantidad (ej: 2 VIP)
    Web->>Cliente: Muestra pantalla de checkout con resumen de compra

    opt Validación Interactiva de Cupón de Descuento
        Cliente->>Web: Ingresa código de cupón (ej: "CYBER2026")
        Web->>API: POST /api/orders/validate-coupon { eventId, code: 'CYBER2026', subtotal }
        activate API
        API->>DB: SELECT * FROM coupons WHERE event_id = :eventId AND UPPER(code) = UPPER(:code)
        API->>API: Evalúa reglas (vigencia, single_use/reusable, min_amount)
        API-->>Web: 200 OK { code, discountAmount, newTotal }
        deactivate API
        Web-->>Cliente: Despliega badge verde y total recalculado
    end

    Cliente->>Web: Selecciona medio de pago y confirma ("Pagar Entradas")
    Web->>API: POST /api/orders/culqi/prepare { eventId, showId, items, paymentMethod, couponCode }
    activate API
    API->>DB: INICIA TRANSACCIÓN ATÓMICA EN POSTGRESQL (QueryRunner)
    API->>DB: 1. SELECT ... FOR UPDATE en zones y zone_pricing_tiers (aforo disponible)
    API->>DB: 2. Valida límite global (event.user_ticket_limit) y por orden (zone.max_tickets_per_order)

    opt Si incluye cupón (Doble Check Concurrente)
        API->>DB: SELECT * FROM coupons WHERE event_id = :eventId FOR UPDATE
        Note over API,DB: Bloqueo pesimista de fila para evitar race conditions
    end

    API->>DB: 3. INSERT INTO orders (status='pending', expires_at = NOW() + 15 min)
    API->>DB: 4. UPDATE tickets SET status='locked', locked_until = NOW() + 15 min
    API->>Culqi: POST /v2/orders (Genera orden Culqi con metadata de auditoría)
    Culqi-->>API: 201 Created { id: 'ord_live_...', payment_code }
    API->>DB: COMMIT TRANSACTION EN POSTGRESQL
    API-->>Web: 201 Created { orderId, orderPublicUuid, culqiOrderId, expiresAt }
    deactivate API

    Web->>Culqi: Abre Modal Culqi Checkout Custom (js.culqi.com/checkout-js)
    Cliente->>Culqi: Ingresa datos de pago (Tarjeta / Yape QR / PagoEfectivo)

    alt Caso A: Pago Inmediato con Tarjeta (Tokenización)
        Culqi-->>Web: Retorna token { id: 'tkn_live_...' }
        Web->>API: POST /api/orders/culqi/confirm-charge { orderPublicUuid, token, deviceId }
        activate API
        API->>Culqi: POST /v2/charges { amount, currency: 'PEN', source_id: token, metadata }
        
        alt Cargo Aprobado en Culqi
            Culqi-->>API: 201 Created { id: 'chr_live_...', outcome: { type: 'venta_exitosa' } }
            API->>DB: INICIA TRANSACCIÓN ATÓMICA
            API->>DB: UPDATE orders SET status='paid'
            API->>DB: UPDATE tickets SET status='sold', qr_code = :signedQrPayload
            API->>DB: UPDATE zones SET sold_count = sold_count + :qty, locked_count = locked_count - :qty
            opt Si tenía cupón
                API->>DB: UPDATE coupons SET used_count = used_count + 1
            end
            API->>DB: INSERT INTO payments (status='approved', external_transaction_id, gateway_response)
            API->>DB: COMMIT TRANSACTION
            API->>API: Despacha correo asíncrono con entradas PDF y QR
            API-->>Web: 200 OK { status: 'PAID', tickets: [...] }
            Web-->>Cliente: PANTALLA VERDE: ¡Compra Exitosa! Entradas listas en /my-tickets
        else Desafío 3D Secure Requerido (REQUIRES_3DS)
            Culqi-->>API: 402 Payment Required { action_code: 'REQUIRES_3DS', parameters: { 3DS: { url } } }
            API-->>Web: 402 { code: 'REQUIRES_3DS', authUrl }
            Web->>Culqi: Invoca Culqi3DS.initAuthentication(...)
            Cliente->>Culqi: Completa autenticación bancaria OTP/3DS
            Web->>API: Reintenta POST /api/orders/culqi/confirm-charge con authentication_3DS
        else Cargo Rechazado por Banco (Fondos insuficientes / Bloqueo)
            Culqi-->>API: 402 Declined { user_message: 'Fondos insuficientes' }
            API-->>Web: 400 Bad Request { error: 'PAYMENT_DECLINED', message: '...' }
            Note over Web,Cliente: Los tickets siguen reservados (status='locked').<br/>El usuario puede reintentar con otra tarjeta o Yape dentro de los 15 min.
        end
        deactivate API

    else Caso B: Pago Asíncrono (Yape / Billetera QR / PagoEfectivo CIP)
        Culqi-->>Web: Muestra código CIP / QR de Yape en pantalla
        Cliente->>Culqi: Paga desde app bancaria o billetera
        Culqi->>API: POST /api/webhooks/culqi (Webhook servidor a servidor con Basic Auth)
        activate API
        API->>Culqi: GET /v2/orders/:id (Verificación activa de autenticidad del pago)
        alt Pago Verificado en Culqi API
            API->>DB: Finaliza orden idempotentemente (status='paid', emite tickets QR)
            API-->>Culqi: 200 OK (Webhook recibido)
            Web->>API: Polling GET /api/orders/culqi/status/:uuid
            API-->>Web: 200 OK { status: 'paid' }
            Web-->>Cliente: Pantalla de Éxito y confirmación inmediata
        else Webhook Vencido o Inválido
            API-->>Culqi: 400 Bad Request
        end
        deactivate API

    else Caso C: Abandono o Cierre sin Pagar
        Cliente->>Web: Cierra modal o pulsa "Cancelar Compra"
        Web->>API: POST /api/orders/culqi/cancel/:orderPublicUuid
        activate API
        API->>DB: Libera reserva anticipadamente (tickets='available', locked_count -= qty)
        API-->>Web: 200 OK { message: 'ORDER_CANCELLED' }
        deactivate API
    end
```

### 4.3 Ciclo de Liberación Dinámica de Stock y Reactivación Automática

El worker en segundo plano se ejecuta periódicamente (cada 60 segundos) para auditar órdenes pendientes:

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Worker de Timeout (Cada 60s)
    participant DB as PostgreSQL (Transacción)
    participant UI as Catálogo Web (Clientes)

    Cron->>DB: SELECT * FROM orders WHERE status='pending' AND expires_at < NOW() FOR UPDATE
    loop Por cada orden abandonada
        Cron->>DB: UPDATE orders SET status = 'expired'
        Cron->>DB: UPDATE tickets SET status = 'available', locked_until = NULL WHERE order_id = :id
        Cron->>DB: UPDATE zones SET locked_count = locked_count - :qty WHERE id = :zone_id
        
        opt Si la orden tenía boletos de Preventa (tier_id)
            Cron->>DB: UPDATE zone_pricing_tiers SET locked_count = locked_count - :qty WHERE id = :tier_id
            alt Fecha tier aún vigente (now() <= tier.end_at)
                Note over Cron,UI: La Preventa 1 recupera stock ➔ Vuelve a activarse con precio promocional
                Cron->>UI: Notificación de WebSocket / Invalida caché: Preventa reabierta
            else Fecha tier ya caducó
                Note over Cron,UI: La Preventa 1 caducó por calendario ➔ Boletos pasan a precio regular
            end
        end

        opt Si la zona estaba marcada "SOLD OUT" temporal
            Note over Cron,UI: El local ya no está lleno ➔ El cartel de "Agotado" desaparece
            Cron->>UI: Zona reabierta: "¡Últimas entradas disponibles!"
        end
    end
```

### 4.4 Resiliencia ante Desconexión del Cliente y Garantía en "Mis Boletos"

Para proteger al usuario contra caídas de internet doméstico, cierre accidental del navegador o cuelgues del dispositivo mientras se procesa el pago:

1. **Desacoplamiento Total del Frontend:**
   * La confirmación de la compra **NO depende de que el navegador del usuario permanezca abierto**.
   * Una vez enviado el formulario de tarjeta a la pasarela, la confirmación se ejecuta exclusivamente mediante comunicación **Servidor a Servidor (Webhook)** entre la pasarela y el backend de Qué Planes Hoy.
2. **Procesamiento Autónomo en Servidor:**
   * Aunque el usuario pierda conexión, el webhook bancario es recibido y procesado por el backend:
     * La orden pasa a `paid`.
     * Los tickets pasan a `sold`.
     * Se genera la firma criptográfica Ed25519 y se graba el `qr_code`.
     * Se despacha el correo electrónico de respaldo con los boletos en PDF.
3. **Recuperación Inmediata en "Mis Boletos / Billetera":**
   * Cuando el usuario restablece su conexión o vuelve a iniciar sesión en la plataforma, sus entradas están disponibles de inmediato en su panel personal:
     $$\text{Ruta Frontend: } \texttt{/my-tickets} \quad \longleftrightarrow \quad \text{Endpoint: } \texttt{GET /api/users/me/tickets}$$
   * La interfaz muestra sus códigos QR activos, datos del recinto, horario y opción de descarga sin requerir ninguna acción adicional ni soporte técnico.

---

## 5. Flujo 3: Control de Acceso y Validación de QR en Puerta (App Escáner)

Detalla cómo el personal de puerta escanea los códigos QR, la validación antifraude con `scanned_at` y la contingencia fuera de línea.

### 5.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Asistente as Asistente con Ticket QR
    actor Validador as Personal de Puerta
    participant App as App Escáner (PWA Móvil)
    participant API as Backend NestJS
    participant DB as PostgreSQL

    Note over Validador,App: AL INICIAR TURNO: Descarga previa de Manifiesto y Llave Pública (events.signing_public_key)

    Asistente->>Validador: Muestra código QR en celular o impreso
    Validador->>App: Escanea el código QR
    
    alt Modo Conectado (Online - 95% del tiempo)
        App->>API: POST /api/tickets/validate-qr { qr_payload, device_id }
        activate API
        API->>DB: SELECT * FROM tickets WHERE qr_code = :qr_payload
        
        alt Ticket válido y sin usar (status == 'sold')
            API->>DB: UPDATE tickets SET status = 'used', scanned_at = NOW()
            API-->>App: 200 OK { result: 'AUTHORIZED', zone: 'VIP', attendee: 'Juan Pérez' }
            App-->>Validador: PANTALLA VERDE + Sonido de Éxito ("Pase VIP Autorizado")
        else Ticket ya utilizado (status == 'used')
            API-->>App: 409 Conflict { result: 'ALREADY_USED', scanned_at: '2026-12-15 19:42:15' }
            App-->>Validador: PANTALLA ROJA + Alerta Sonora ("Boleto ya usado a las 19:42:15")
        else Ticket inexistente o fraudulento
            API-->>App: 404 Not Found { result: 'INVALID_TICKET' }
            App-->>Validador: PANTALLA ROJA ("Código QR no registrado")
        else Ticket cancelado o reembolsado
            API-->>App: 400 Bad Request { result: 'CANCELLED_TICKET' }
            App-->>Validador: PANTALLA ROJA ("Entrada Anulada por Reembolso")
        end
        deactivate API

    else Modo Contingencia (Sin Internet en Puerta)
        App->>App: Valida firma digital localmente con events.signing_public_key
        alt Firma válida y en lista local sin usar
            App->>App: Marca en SQLite local: status='used', scanned_at=NOW()
            App-->>Validador: PANTALLA VERDE ("Autorizado Offline")
            Note over App,API: En cuanto recupera red: Envía ráfaga de boletos validados (Background Sync)
        else Ya marcado localmente
            App-->>Validador: PANTALLA ROJA ("Boleto ya ingresó localmente")
        end
    end
```

---

## 6. Flujo 4: Ciclo Financiero: Anticipos a Cuenta y Liquidación Final

Regula la custodia del dinero recaudado, el impacto de los cupones de descuento en el saldo disponible, la carga obligatoria de comprobantes bancarios y el cierre definitivo inmutable 1 a 1.

### 6.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Org as Promotor del Evento
    actor Admin as Administración / Finanzas QPH
    participant Web as Panel Administrativo
    participant API as Backend NestJS
    participant S3 as Storage Seguro (S3/Cloud)
    participant DB as PostgreSQL
    participant Banco as Banca Empresa (BCP / BBVA / Interbank)

    Note over Org,Banco: FASE A: SOLICITUD DE ANTICIPOS A CUENTA (Durante la Venta - 1 a N)
    Org->>Web: Solicita adelanto (ej: S/ 10,000 para señas)
    Web->>API: GET /api/events/:id/financial-summary
    API->>DB: Calcula Recaudación Neta Custodiada = Ventas Cobradas - Comisiones Ticketera - Comisiones Pasarela
    API-->>Web: Devuelve { available_balance, gross_nominal, total_discount_from_coupons, advances_paid }
    Web-->>Org: Muestra saldo real disponible (considerando cupones aplicados)
    
    Org->>Web: Envía solicitud de adelanto con cuenta bancaria y CCI
    Web->>API: POST /api/events/:id/advances { amount: 10000, bank_account_cci }
    API->>DB: INSERT INTO event_advances (status='requested', amount=10000)
    Admin->>Web: Revisa recaudación acumulada y aprueba solicitud
    Admin->>Banco: Ejecuta transferencia bancaria
    Banco-->>Admin: Emite Comprobante Oficial (Nro Operación: 849201 + Voucher PDF)
    Admin->>Web: Carga voucher PDF y digita Nro de Operación
    Web->>S3: Sube comprobante bancario
    S3-->>Web: URL voucher (transfer_voucher_url)
    Web->>API: POST /api/advances/:id/pay { transfer_reference: '849201', transfer_voucher_url }
    API->>DB: UPDATE event_advances SET status='paid', paid_at=NOW()

    Note over Org,Banco: FASE B: LIQUIDACIÓN FINAL (Relación 1 a 1 Estricta al concluir el Show)
    Org->>Web: Solicita Liquidación Final del Evento
    Web->>API: POST /api/events/:id/settlements/request
    activate API
    API->>DB: Calcula ventas brutas de tickets vendidos (status IN ('sold', 'used'))
    API->>DB: SELECT COALESCE(SUM(discount_amount), 0) FROM orders WHERE event_id=:id AND status='paid' (total_coupons_discount_amount)
    API->>DB: Suma comisiones de ticketera QPH (platform_fee)
    API->>DB: Suma comisiones de pasarela de pago (gateway_fee)
    API->>DB: SELECT SUM(amount) FROM event_advances WHERE status='paid' (total_advances_amount)
    API->>DB: Genera Subreporte JSONB (breakdown_by_zone con zonas, tiers, cupones canjeados y anticipos)
    API->>DB: INSERT INTO event_settlements (event_id UNIQUE, status='in_review', gross_amount, total_coupons_discount_amount, net_payout_amount)
    deactivate API

    Admin->>Web: Audita corte congelado y aprueba desembolso
    Admin->>Banco: Realiza transferencia del saldo final neto
    Banco-->>Admin: Constancia bancaria de saldo final
    Admin->>Web: Carga voucher final y digita Nro de Operación
    Web->>S3: Sube voucher final
    Web->>API: POST /api/settlements/:id/complete { transfer_reference, transfer_voucher_url }
    API->>DB: UPDATE event_settlements SET status='paid', paid_at=NOW()
    API->>Org: Notificación con Estado de Cuenta Oficial y Voucher Bancario descargable
```

### 6.2 Fórmula de Liquidación Inmutable:
$$\text{Saldo Final a Transferir} = \text{Ventas Brutas} - \mathbf{\text{Total Descuento Cupones}} - \text{Comisión QPH} - \text{Pasarelas} - \mathbf{\text{Total Anticipos Ya Pagados}} - \text{Ajustes}$$

---

## 7. Resumen de Estados de Entidades en los Flujos

| Entidad | Campo de Estado | Valores Posibles | Transición Típica |
| :--- | :--- | :--- | :--- |
| **`users`** | `role` / `is_organizer` / `email_verified_at` | `customer`, `admin` / `false ➔ true` / `NULL ➔ NOW()` | Registro ➔ Verificación Email ➔ Activación Promotor |
| **`events`** | `status` | `draft`, `published`, `paused`, `cancelled` | `draft` ➔ `published` |
| **`shows`** | `status` | `scheduled`, `ongoing`, `completed`, `cancelled` | `scheduled` ➔ `ongoing` ➔ `completed` |
| **`zone_pricing_tiers`** | `is_active` | `true`, `false` | `true` (activo) ➔ `false` (agotado o caducado) |
| **`coupons`** | `is_active` / `usage_type` | `true`, `false` / `single_use`, `reusable` | Creado ➔ Canjeado (`used_count`++) ➔ Agotado |
| **`orders`** | `status` | `pending`, `paid`, `expired`, `cancelled`, `refunded` | `pending` ➔ `paid` (o `expired` a los 10 min) |
| **`tickets`** | `status` | `available`, `locked`, `sold`, `used`, `cancelled` | `available` ➔ `locked` ➔ `sold` ➔ `used` |
| **`payments`** | `status` | `pending`, `approved`, `rejected`, `refunded` | `pending` ➔ `approved` |
| **`event_advances`** | `status` | `requested`, `in_review`, `approved`, `paid`, `rejected` | `requested` ➔ `approved` ➔ `paid` |
| **`event_settlements`** | `status` | `requested`, `in_review`, `approved`, `paid`, `rejected` | `requested` ➔ `approved` ➔ `paid` |

---

## 8. Flujo 5: Búsqueda Instantánea e Indexación con Meilisearch

Garantiza respuestas de búsqueda en menos de 30ms con tolerancia a errores tipográficos (*typo-tolerance*), filtros facetados por categoría/precio/ubigeo y sin sobrecargar la base de datos transaccional PostgreSQL.

### 8.1 Sincronización Automática e Indexación

```mermaid
sequenceDiagram
    autonumber
    actor Org as Organizador
    participant API as Backend NestJS
    participant DB as PostgreSQL
    participant Meili as Meilisearch (:7700)
    actor Publico as Usuario Público
    participant Web as Web (Next.js)

    Note over Org,Meili: FASE A: INDEXACIÓN AL PUBLICAR
    Org->>API: POST /api/events/:id/publish
    API->>DB: UPDATE events SET status='published'
    API->>Meili: POST /indexes/events/documents { id, title, slug, category, ubigeoCode, minPrice, date, bannerUrl }
    Meili-->>API: 202 Accepted (Indexado)
    API-->>Org: 200 OK (Evento Publicado y Listo en Búsqueda)

    Note over Publico,Meili: FASE B: BÚSQUEDA INSTANTÁNEA EN TIEMPO REAL
    Publico->>Web: Escribe en la barra de búsqueda ("conciert...")
    Web->>API: GET /api/v1/search/events?q=conciert&category=CONCERTS
    API->>Meili: POST /indexes/events/search { q, filter, limit: 20, sort: ['date:asc'] }
    Meili-->>API: Resultados rankeados (< 20ms)
    API-->>Web: 200 OK { hits, totalHits, processingTimeMs }
    Web-->>Publico: Desplegable instantáneo con fotos, fechas y precios
```

### 8.2 Sincronización Masiva en Lote y Resiliencia DevSecOps

1. **Aislamiento Estricto de Borradores (Draft Isolation):**  
   Meilisearch **NUNCA** almacena eventos en estado `draft`, `paused` o `cancelled`. Al crear un evento, este permanece exclusivamente en PostgreSQL. Solo la aprobación y publicación (`POST /api/events/:id/publish`) lo ingresa al motor de búsqueda. Cualquier llamada a `indexEvent` con un evento no publicado es rechazada y fuerza su eliminación del índice (`removeEvent`).
2. **Reindexación en Lote y Purga de Seguridad (`POST /api/v1/search/sync`):**  
   Ejecuta una purga total de documentos en Meilisearch (`DELETE /indexes/events/documents`) para erradicar cualquier registro residual, y luego reconstruye el catálogo leyendo estrictamente de PostgreSQL con `where: { status: 'published' }`.
3. **Listado Dinámico de Ciudades Activas (`GET /api/v1/search/cities`):**  
   Retorna únicamente las ciudades que cuentan con eventos publicados (`status = 'published'`), con el conteo de eventos activos por ciudad (`eventCount`). Evita desplegar departamentos o regiones sin eventos registrados para proteger la UX de los usuarios.
4. **Degradación Elegante (Modo Pasivo):**  
   Si Meilisearch está reiniciándose o desconectado, las peticiones HTTP del backend cuentan con `AbortSignal.timeout(3000)`. La API no colapsa y devuelve un resultado vacío seguro sin exponer mensajes de infraestructura al cliente.
5. **Privacidad de Arquitectura:**  
   Los payloads y respuestas expuestas al público ocultan los identificadores de motores internos (`engine: Search Engine` / `healthy: true`).

### 8.3 Selección de Eventos Destacados para el Hero Carousel (`GET /api/v1/events/featured`)

1. **Aislamiento de Negocio:** El campo `is_featured` NO se expone en la creación de eventos para evitar auto-asignación por promotores; queda reservado para administración y planes de monetización.
2. **Estrategia Híbrida (Máx 5 Eventos):**
   * Prioridad 1: Consulta eventos con `status = 'published'` e `is_featured = true`.
   * Prioridad 2: Si hay menos de 5, rellena automáticamente con los eventos publicados más recientes hasta completar el cupo.
3. **Navegación Inteligente en Clientes:** Si el evento cuenta con landing page dedicada (`has_landing_page = true` y `slug`), el CTA conduce a `/e/:slug`. De lo contrario, conduce a la vista pública de detalle `/events/:id`.


---

## 9. Flujo 6: Caché en Memoria con Redis para Hero Carousel e Invalidación a Demanda

Garantiza tiempos de respuesta inmediatos (< 3ms) en el Hero Carousel de portada evitando golpear a PostgreSQL con miles de lecturas concurrentes, manteniendo una vigencia automática de 12 horas y proporcionando endpoints administrativos para purga y regeneración en caliente.

### 9.1 Diagrama de Secuencia: Lectura, Cache HIT / MISS y Purga

```mermaid
sequenceDiagram
    autonumber
    actor Publico as Visitante / Web
    participant Web as Web (Next.js)
    participant API as Backend NestJS
    participant Redis as Redis Cache (:6379)
    participant DB as PostgreSQL (:5433)
    actor Admin as Administrador

    Note over Publico,DB: ESCENARIO 1: LECTURA DEL HERO CAROUSEL (CACHE HIT)
    Publico->>Web: Carga la página principal (Home)
    Web->>API: GET /events/featured
    API->>Redis: GET qph:home:hero
    Redis-->>API: 200 Datos en memoria (JSON)
    API-->>Web: 200 OK [FeaturedEventResponseDto x5] (< 3ms)
    Web-->>Publico: Renderiza carrusel dinámico con fotos y CTA inteligente

    Note over Publico,DB: ESCENARIO 2: CACHE MISS (EXPIRADO TRAS 12 HORAS O PRIMERA CONSULTA)
    Publico->>Web: Carga la página principal (Home)
    Web->>API: GET /events/featured
    API->>Redis: GET qph:home:hero
    Redis-->>API: null (Cache MISS)
    API->>DB: SELECT eventos WHERE status='published' ORDER BY is_featured DESC, createdAt DESC LIMIT 5
    DB-->>API: 5 Eventos con imágenes, funciones y zonas
    API->>Redis: SETEX qph:home:hero 43200 <JSON> (TTL: 12 horas)
    API-->>Web: 200 OK [FeaturedEventResponseDto x5]
    Web-->>Publico: Renderiza carrusel dinámico

    Note over Admin,DB: ESCENARIO 3: INVALIDACIÓN Y REGENERACIÓN EN CALIENTE A DEMANDA
    Admin->>API: POST /events/featured/cache/purge
    API->>Redis: DEL qph:home:hero
    API->>DB: Consulta fresca a PostgreSQL (skipCache=true)
    DB-->>API: 5 Eventos actualizados
    API->>Redis: SETEX qph:home:hero 43200 <JSON>
    API-->>Admin: 200 OK { purged: true, recreated: true, count: 5, ttlSeconds: 43200 }
```

### 9.2 Reglas Operativas y DevSecOps

1. **Namespace Jerárquico en Redis (`qph:home:*`):**
   * `qph:home:hero`: Hero Carousel (TTL: 12 horas).
   * `qph:home:upcoming`: Próximos eventos cronológicos (TTL: 15 minutos).
   * `qph:home:weekly_featured`: Destacados de la semana / selección editorial (TTL: 15 minutos).
   * `qph:home:weekend`: Planes para fin de semana vigente (TTL: 15 minutos).
2. **TTL Adaptativo para Inventario Vivo:**
   * Las secciones con aforo y boletos en movimiento (`upcoming`, `weekly_featured`, `weekend`) operan con un TTL de **15 minutos** (900 s) para refrescar el `urgencyBadge` periódicamente sin sobrecargar la base de datos.
3. **Purga Global de Portada en Caliente (`POST /events/home/cache/purge`):**
   * Emplea `delPattern('qph:home:*')` para erradicar simultáneamente todas las secciones de la Home en Redis.
   * Ejecuta en paralelo las 4 consultas a PostgreSQL (*Cache Warm-up*) y repuebla de inmediato las 4 claves con sus nuevos TTLs, asegurando una experiencia instantánea al siguiente visitante.
4. **Degradación Elegante:** Si la conexión a Redis no está disponible o el servicio se reinicia, el backend loguea una advertencia controlada y efectúa la consulta directamente en PostgreSQL sin lanzar excepciones 500 al cliente.

---

## 10. Flujo 7: Experiencia Inmersiva de Landing Page Dedicada (`/e/[slug]`), Header Teleticket-style y Caché Redis

Permite a eventos especiales con `hasLandingPage = true` ofrecer una experiencia de marca personalizada (fondo por color sólido o patrón en mosaico, botón CTA custom, teaser de YouTube, highlights y tarifas) manteniendo la identidad de la ticketera con un header superior fijo estilo Teleticket y preloader con isotipo animado de QPH.

### 10.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Fan as Visitante / Fan
    participant Web as Next.js (/e/[slug])
    participant UseCase as GetEventLandingUseCase (neverthrow)
    participant API as Backend NestJS
    participant Redis as Redis Cache (:6379)
    participant DB as PostgreSQL (:5433)

    Fan->>Web: Ingresa a /e/los-portales-del-huayllabamba
    Web->>Web: Despliega LandingPreloader (Isotipo QPH pulsante)
    Web->>UseCase: execute("los-portales-del-huayllabamba")
    UseCase->>API: GET /events/landing/los-portales-del-huayllabamba

    alt Cache HIT en Redis
        API->>Redis: GET qph:events:landing:los-portales-del-huayllabamba
        Redis-->>API: 200 JSON en memoria (< 3ms)
    else Cache MISS o Expirado
        API->>Redis: GET qph:events:landing:los-portales-del-huayllabamba (null)
        API->>DB: SELECT event + images + shows + zones + tiers WHERE slug = :slug AND status = 'published'
        DB-->>API: Registro completo del evento
        API->>API: Valida hasLandingPage = true y calcula preventas en cascada
        API->>API: Normaliza landingConfig (theme, header, body, footer)
        API->>Redis: SETEX qph:events:landing:los-portales-del-huayllabamba 900 <JSON>
    end

    API-->>UseCase: 200 OK (EventLandingResponseDto)
    UseCase-->>Web: ok(EventLandingModel)
    Web->>Web: Oculta LandingPreloader con animación suave (fade-out)
    Web-->>Fan: Renderiza Vista Inmersiva con Header Teleticket y Secciones Granulares

    opt Interacción de Compra de Entrada
        Fan->>Web: Clic en "Comprar" en zona seleccionada (sin selector - 1 +)
        Web-->>Fan: Redirige a /events/[id] para el flujo de Checkout
    end

    opt Retorno al Home
        Fan->>Web: Clic en Logo Oficial QPH del Header
        Web-->>Fan: Redirige de inmediato a la cartelera principal (/)
    end
```

### 10.2 Reglas de Arquitectura Híbrida y Alta Conversión (CRO / UX)

1. **Aislamiento Visual y Diseño Panorámico Full-Width:** La ruta `/e/[slug]` reside fuera de la agrupación `(main)`, heredando únicamente `RootLayout`. Se elimina cualquier contenedor central angosto (`max-w-2xl`), estructurando cada sección para acaparar el 100% del ancho de la pantalla (`w-full`), con fondos cinemáticos en gradiente hacia `deep-slate` y paneles de vidrio (*glassmorphism*).
2. **Navegación Fija estilo Teleticket:**
   * Logo oficial de QPH a la izquierda con enlace directo a `/` para volver a la tienda en cualquier momento.
   * Menú ancla de acceso directo: `INICIO` (`#landing-inicio`), `ENTRADAS` (`#zonas-entradas`), `LEGALES` (`#landing-legales`).
   * Botón CTA destacado con el color principal (`primaryColor`) y texto configurado (`ctaText`).
3. **Franja Flotante de 4 Métricas (`-mt-10`):**
   * Resumen inmediato sin scroll: 📅 *Fecha & Hora*, 📍 *Lugar & Ciudad*, 💳 *Entradas Desde (S/.)*, 🛡️ *Acceso Criptográfico Ed25519*.
4. **Núcleo Transaccional (Zonas + Croquis Lado a Lado):**
   * En pantallas de escritorio, el croquis oficial del escenario (`body.bodyImageUrl`) y el listado de tarifas se sitúan en paralelo (7 columnas para zonas y 5 para croquis). El comprador visualiza la ubicación física y presiona *"Comprar"* sin scroll innecesario ni selectores `- 1 +`.
5. **Cero Fricción y Highlights Compactos:**
   * Se erradica el texto editorial tipo blog. Los atractivos se resumen en viñetas de 1 línea con checks (`primaryColor`) y una barra de 1 clic para copiar la URL amigable con feedback instantáneo (`navigator.clipboard`).

---

## 11. Flujo 8: Tarea Cron de Cierre Automático de Shows y Eventos Vencidos (01:00 AM)

Automatiza el ciclo de vida de espectáculos y funciones en la plataforma, asegurando que las funciones pasadas no admitan compras y que los eventos concluidos se retiren automáticamente de la cartelera pública sin intervención manual de los promotores.

### 11.1 Diagrama de Secuencia: Ejecución del Cron (01:00 AM)

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron Runner (@nestjs/schedule)
    participant Service as EventStatusCronService
    participant DB as PostgreSQL (:5433)
    participant Search as MeiliSearch (:7700)
    participant Redis as Redis Cache (:6379)

    Note over Cron,Redis: EJECUCIÓN PROGRAMADA DIARIA (01:00 AM HORA PERÚ - America/Lima)
    Cron->>Service: handleDailyExpiredStatusCron() [0 1 * * *]
    Service->>DB: SELECT shows WHERE status IN ('scheduled', 'ongoing')
    DB-->>Service: Lista de funciones activas
    Service->>Service: Evalúa: (startTime + durationHours) <= NOW()
    opt Existen Shows Vencidos
        Service->>DB: UPDATE shows SET status = 'completed' WHERE id IN (:expiredIds)
        DB-->>Service: Shows actualizados
    end

    Service->>DB: SELECT events con shows WHERE status = 'published'
    DB-->>Service: Lista de eventos publicados con sus funciones
    Service->>Service: Evalúa si TODOS los shows del evento finalizaron (ningún show futuro activo)
    opt Existen Eventos con Todos sus Shows Vencidos
        Service->>DB: UPDATE events SET status = 'completed' WHERE id IN (:completedEventIds)
        DB-->>Service: Eventos actualizados a 'completed'
        Service->>Search: indexEvent() con status: 'completed' para cada evento finalizado
        Search-->>Service: Índice de búsqueda actualizado
        Service->>Redis: DEL qph:home:hero, qph:home:upcoming, qph:home:weekly_featured, qph:home:weekend
        Service->>Redis: DEL qph:events:landing:[slug], qph:events:detail:[uuid]
        Redis-->>Service: Claves de caché invalidadas
    end
    Service-->>Cron: Resumen de auditoría (X shows, Y eventos completados)
```

### 11.2 Reglas Operativas y Criterios de Transición

1. **Expresión Cron y Zona Horaria:**
   * Se ejecuta diariamente a la 1:00 AM con la expresión `'0 1 * * *'` bajo la zona horaria del negocio `America/Lima`.
2. **Cálculo de Término de la Función (Show):**
   * Un show se considera finalizado cuando:
     $$\text{Fecha de Fin} = \text{startTime} + \text{durationHours (default 2h)} \le \text{NOW()}$$
   * Al cumplirse esta condición, su estado transiciona a `'completed'`.
3. **Cierre Integral de Eventos:**
   * Un evento con estado `'published'` transiciona a `'completed'` únicamente si **todos sus shows asociados están concluidos** (es decir, ningún show permanece agendado a futuro con fecha vigente).
4. **Sincronización de Búsqueda y Caché:**
   * Al finalizar eventos, se actualiza el estado en MeiliSearch y se invalidan de forma atómica todas las claves de caché de portada en Redis (`qph:home:*`), garantizando que la cartelera pública refleje siempre eventos vigentes.
5. **Disparo Manual / Auditoría:**
   * Se dispone del endpoint `POST /api/events/admin/sync-expired-status` para que administradores o pruebas automatizadas puedan gatillar el proceso bajo demanda.

---

## 12. Flujo 9: Carga Masiva de Eventos de Prueba (Seeding Administrativo)

Permite poblar la base de datos bajo demanda con una cantidad dinámica de eventos realistas (`POST /api/events/admin/seed?count=N`), listos para validar el Hero Carousel, secciones de la Home, filtros por ciudad, Landing Pages y la tarea Cron de eventos vencidos.

### 12.1 Diagrama de Secuencia: Carga Masiva de Eventos

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Administrador / Tester
    participant API as Backend NestJS
    participant Seeder as EventSeederService
    participant DB as PostgreSQL (:5433)
    participant Search as MeiliSearch (:7700)
    participant Redis as Redis Cache (:6379)

    Admin->>API: POST /api/events/admin/seed?count=15 (o { "count": 15 })
    API->>Seeder: seedEvents(15)
    Seeder->>DB: Obtiene o asegura usuario organizador oficial
    loop Para cada uno de los N eventos solicitados
        Seeder->>DB: Inserta EventEntity (status='published', slug único)
        Seeder->>DB: Inserta 1 o 2 ShowEntity (repartición: pasados, hoy, fin de semana, futuro)
        Seeder->>DB: Inserta ZoneEntity (VIP, General) con ZonePricingTierEntity
        Seeder->>DB: Inserta EventImageEntity (banner oficial + galería en WebP)
        Seeder->>Search: indexEvent() en MeiliSearch para búsqueda instantánea
    end
    Seeder->>Redis: DEL qph:home:hero, qph:home:upcoming, qph:home:weekly_featured, qph:home:weekend
    Redis-->>Seeder: Caché purgada
    Seeder-->>API: SeedEventsResponseDto con resumen detallado
    API-->>Admin: 201 Created { requestedCount: 15, pastEventsCount: 4, upcomingEventsCount: 11, ... }
```

### 12.2 Distribución Temporal de los Eventos Creados

* **25% Eventos Pasados (Hace 1 a 3 días):** Diseñados específicamente para probar la tarea Cron (`POST /api/events/admin/sync-expired-status`) y comprobar que pasan de forma atómica a `completed`.
* **25% Eventos de Hoy (Esta noche a las 21:00):** Para probar los eventos de consumo inmediato en portada.
* **25% Eventos del Fin de Semana (Próximo Sábado):** Para poblar y validar la sección `weekend` de Redis.
* **25% Eventos a Mediano Plazo (En 12 a 35 días):** Para probar la cartelera general, paginación y filtros por categoría y ciudad.

### 12.3 Cupones de Descuento y Experiencia Multimedia (YouTube)

* **Cupones Activos por Evento:** Cada evento genera automáticamente 2 cupones promocionales reutilizables en `coupons`:
  * Cupón Porcentual: `PROMO15-[SUFIJO]` (15% de descuento en el total de entradas).
  * Cupón de Monto Fijo: `VIP20-[SUFIJO]` (S/ 20.00 de rebaja directa con compra mínima de S/ 60.00).
* **Teaser de YouTube en Landing Pages:** Los eventos con `hasLandingPage = true` configuran un enlace oficial de YouTube en `landingConfig.header.videoTeaserUrl`, habilitando en el frontend el botón flotante de reproducción y el modal `VideoTeaserModal`.

---

## 13. Flujo 13: Lista de Favoritos (Persistencia y Sincronización)

Permite a los usuarios marcar/desmarcar eventos como favoritos desde tarjetas o páginas de detalle, sincronizando en tiempo real la colección personal del usuario con la base de datos `user_favorite_events`.

### 13.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario
    participant Web as Frontend Next.js (Card / Detalle)
    participant Store as Hook useFavorites & EventBus
    participant API as Backend NestJS (UsersModule)
    participant DB as PostgreSQL (user_favorite_events)

    Usuario->>Web: Clic en el corazón (favorite)
    alt Usuario no autenticado
        Web->>Usuario: Redirige a /login?redirect=/events/...
    else Usuario autenticado
        Web->>Store: Optimistic Update inmediato
        Store-->>Web: Alterna estado visual (corazón relleno/vacío)
        Web->>API: POST /api/users/favorites/:eventId/toggle
        API->>DB: SELECT * FROM user_favorite_events WHERE user_id AND event_id
        alt Ya existía
            API->>DB: DELETE FROM user_favorite_events
            API-->>Web: 200 OK { isFavorite: false }
        else No existía
            API->>DB: INSERT INTO user_favorite_events (user_id, event_id)
            API-->>Web: 200 OK { isFavorite: true }
        end
        Store->>Web: window.dispatchEvent('qph:favorites-updated')
    end
```

---

## 14. Flujo 14: Restablecimiento de Contraseña (Password Reset con Token Temporal)

Flujo seguro en 2 pasos para recuperar el acceso a la cuenta con tokens encriptados con caducidad (10-15 min) y rate limiting anti-fuerza bruta.

### 14.1 Diagrama de Secuencia

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuario
    participant Web as Web (Recuperar / Restablecer)
    participant API as Backend NestJS (AuthModule)
    participant Redis as Redis (TTL 15 min)
    participant Mail as Servicio de Email (SMTP/Resend)
    participant DB as PostgreSQL (users)

    Note over Usuario,Mail: Paso 1: Solicitud de Restablecimiento
    Usuario->>Web: Ingresa correo en /forgot-password
    Web->>API: POST /api/auth/forgot-password { email } (Rate Limited)
    API->>DB: Verifica si el correo existe
    opt Correo registrado
        API->>Redis: SETEX pwd_reset:<token> 900 <userId>
        API->>Mail: Envía correo con enlace /reset-password?token=<token>
    end
    API-->>Web: 200 OK (Respuesta opaca para evitar enumeración de correos)

    Note over Usuario,DB: Paso 2: Cambio de Contraseña
    Usuario->>Web: Clic en link del correo -> abre /reset-password?token=...
    Usuario->>Web: Ingresa nueva contraseña y confirma
    Web->>API: POST /api/auth/reset-password { token, newPassword }
    API->>Redis: GET pwd_reset:<token>
    alt Token válido
        API->>DB: UPDATE users SET password_hash = bcrypt(newPassword)
        API->>Redis: DEL pwd_reset:<token>
        API->>Mail: Envía correo de confirmación "Tu contraseña ha sido cambiada"
        API-->>Web: 200 OK
        Web-->>Usuario: Mensaje de éxito y redirección a /login
    else Token inválido o expirado
        API-->>Web: 400 Bad Request { message: "Token inválido o expirado" }
    end
```

### 14.2 Cambio de Contraseña Autenticado (`POST /api/auth/change-password`)
- Protegido con `JwtAuthGuard` y limitador `@Throttle` (máx. 5 intentos cada 15 min).
- Valida mediante `ChangePasswordHandler` que el usuario autenticado posea contraseña local (`password_hash`), compara `oldPassword` con bcrypt (`INVALID_CURRENT_PASSWORD` → HTTP 400 si no coincide), exige que `newPassword` sea distinta a la actual (mín. 6 caracteres), actualiza `users.password_hash` y envía notificación informativa por correo.

---

## 15. Servicio Transaccional de Correos (`MailModule` + Resend API)

Módulo global (`@Global()`) ubicado en `src/modules/mail/` encargado de despachar los correos transaccionales de la plataforma mediante la API REST oficial de **Resend** (`POST https://api.resend.com/emails`) con timeout explícito (`RESEND_TIMEOUT_MS`, default `5000ms`), fallback controlado a consola local cuando `RESEND_API_KEY` no está configurada (sin imprimir enlaces/tokens en producción) y sanitización HTML estricta en `mail-template.builder.ts`.

* **Métodos y plantillas implementados en `MailService` (`TicketPdfService` + `mail-template.builder.ts`):**
  * `sendEmail(input)`: envío genérico tipado con HTML, texto alternativo, `reply_to`, `tags` y soporte para adjuntos Base64 (`attachments`) e imágenes inline (`content_id` / `cid:`).
  * `sendVerificationEmail`: verificación de correo electrónico en registro/reenvío (`AuthModule`).
  * `sendWelcomeGoogleEmail`: bienvenida automática para usuarios nuevos registrados por primera vez mediante Google OAuth (`GoogleCallbackHandler`).
  * `sendPasswordResetEmail`: recuperación de contraseña de un solo uso con vigencia de 15 minutos (`AuthModule`).
  * `sendPasswordChangedNotificationEmail`: alerta informativa cuando se actualiza o restablece la contraseña (`AuthModule`).
  * `sendOrderTicketsEmail`: disparado automáticamente al pasar una orden a `paid` en `OrderLifecycleService.finalizePaidOrder` (una sola vez); adjunta el documento **PDF oficial (`entradas-#QPH-XXXXXX.pdf`)** generado con `TicketPdfService` (`pdfkit` + `qrcode`), incrusta los QR inline (`cid:`) en el cuerpo HTML (hasta 6 tickets inline) y enlaza al visor web (`/profile/tickets`).
  * `sendOrganizerActivatedEmail`: confirmación automática al habilitar el perfil comercial de Organizador (`BecomeOrganizerHandler`).
  * `sendOrganizerKycVerifiedEmail`: plantilla lista para aprobación administrativa KYC de la productora.
  * `sendEventPublishedEmail`: confirmación automática al promotor cuando publica un evento (`PublishEventHandler`) con el enlace público (`/e/:slug` o `/events/:uuid`).
  * `sendAdvancePaidEmail` y `sendSettlementPaidEmail`: plantillas listas para notificar desembolsos bancarios de anticipos y cierre contable de liquidación final.

---

## 16. Panel del Organizador: Listado Real de Mis Eventos (`GET /api/events/organizer`)

Endpoint protegido con `JwtAuthGuard` en `EventsController` (ubicado antes de `GET /api/events/:identifier` para evitar colisión de rutas) atendido por `GetOrganizerEventsHandler`:

1. **Aislamiento de Propietario (BOLA - OWASP API1):** Filtra estrictamente `events.organizer_id = user.id` resuelto desde el JWT verificado (`req.user.sub`), ignorando cualquier identificador externo.
2. **Código y Estados Reales:** Genera `eventCode` determinístico (`#EV-${publicUuid.substring(0, 8).toUpperCase()}`) y alinea los estados reales (`draft`, `published`, `paused`, `completed`, `cancelled`, más indicador `isSoldOut` cuando `ticketsSold >= capacity` y preventa activa vigente).
3. **Métricas Agregadas Parametrizadas (PostgreSQL):**
   * Suma boletos confirmados (`tickets.status IN ('sold', 'used')`) y `paid_base_price` agrupados por `event_id` y `zone_id` para reflejar el monto real vendido según cada fase de preventa.
   * Calcula los descuentos de cupones aplicados (`orders.discount_amount` de órdenes `paid`, deduplicando por `order.id`) usando `COALESCE(orders.event_id, shows.event_id)`.
   * Expone `netSalesRevenue` (`grossRevenue - couponsDiscountAmount`), `targetRevenue` (`SUM(zone.capacity * zone.regularPrice)`), `settlementStatus`, y `draftChecklist` dinámico para borradores.







