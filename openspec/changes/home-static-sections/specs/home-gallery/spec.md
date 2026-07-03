# Delta Spec: `home-gallery` (NEW capability)

**Change**: `home-static-sections`
**Capability**: `home-gallery` (new)
**Source artifacts**: `openspec/changes/home-static-sections/exploration.md`, `proposal.md`
**Type**: ADDED (new capability; no prior `home-gallery` spec exists)
**Strict TDD**: ACTIVE for backend (pytest in `backend/tests/test_gallery.py`)
**Locked decisions referenced**: Approach A (standalone `GalleryItem` table + dedicated endpoints), 6 slots fixed 1..6, public `GET /gallery` returns 6 items, admin CRUD trio requires auth, lightbox as custom modal, external URLs only (no file upload).

---

## Purpose

`home-gallery` is the admin-configurable image gallery surfaced on the public Home page ("Sección de Trabajos Realizados"). The admin manages up to 6 image slots via a dedicated panel; the public page renders a CSS Grid of active items, with per-item click behavior (link or lightbox). All content is config-driven — no code changes are needed to update the gallery.

This capability owns:

- The `GalleryItem` SQLModel aggregate and its Pydantic schemas.
- The 4 HTTP endpoints (1 public GET + 3 admin CRUD).
- The public `GallerySection` component (grid + lightbox).
- The admin `GallerySection` component (slot editors + DataTable).
- The cross-cutting data hook `useGallery` (read) and admin mutations (create/update/delete).

Out of scope (covered elsewhere): brand assets (logo, favicon) — see `home-static-content`. Carousel pattern — explicitly rejected (WCAG 2.2.2). File upload service — explicitly rejected (external URLs only).

---

## Requirements

### REQ-HGAL-001 — Modelo `GalleryItem` (MUST)

El backend DEBE exponer la tabla `galleryitem` con los campos: `id` (PK, autoincremental), `orden` (int, 1..6, único entre filas activas), `image_url` (str, obligatorio, URL válida), `link_url` (str opcional, URL válida o null), `alt_text` (str, 1..200 chars, obligatorio), `activo` (bool, default false), `created_at` y `updated_at` (datetime). La tabla DEBE crearse automáticamente al iniciar el backend vía `SQLModel.metadata.create_all`. La unicidad de `orden` aplica sólo entre filas activas: dos slots inactivos con el mismo `orden` pueden coexistir, pero no dos filas activas con el mismo `orden`.

#### Scenario: Tabla y 6 slots inactivos se crean al primer arranque
- DADO un backend recién instalado con DB vacía
- CUANDO arranca el servidor
- THEN `SQLModel.metadata.create_all` crea la tabla `galleryitem`
- Y `seed_default_gallery` inserta exactamente 6 filas inactivas con `orden = 1..6`
- Y `GET /gallery` responde 200 con 6 items

---

### REQ-HGAL-002 — Schemas Pydantic (MUST)

El backend DEBE exponer `GalleryItemRead`, `GalleryItemCreate`, `GalleryItemUpdate` con `ConfigDict(from_attributes=True)`. `image_url` y `link_url` DEBEN validarse como URL (rechazando `file://`, strings no-URL, espacios). `alt_text` DEBE ser no vacío y ≤ 200 chars. `orden` DEBE ser 1..6 en Create. `Update` DEBE aceptar todos los campos como opcionales excepto `orden` (que es inmutable tras la creación).

#### Scenario: Create rechaza orden fuera de rango
- DADO un admin autenticado
- CUANDO envía `POST /gallery` con `orden = 7`
- THEN el sistema responde 422 con detalle de validación `orden` `le=6`

#### Scenario: Create rechaza URL inválida y alt_text vacío
- DADO un admin autenticado
- CUANDO envía `POST /gallery` con `image_url = "not-a-url"` y `alt_text = ""`
- THEN el sistema responde 422 con detalles en `image_url` (URL inválida) Y `alt_text` (`min_length=1`)

---

### REQ-HGAL-010 — Endpoint público `GET /gallery` (MUST)

El backend DEBE exponer `GET /gallery` (sin autenticación) que devuelve una lista de hasta 6 items ordenados por `orden` ASC. La respuesta incluye todos los slots (activos e inactivos) — el filtro de visibilidad se aplica en el frontend. El endpoint NO devuelve 404 cuando no hay items: en ese caso devuelve `[]` con 200.

#### Scenario: Galería sin items configurados devuelve lista vacía
- DADO una DB con la tabla `galleryitem` vacía
- CUANDO un visitante anónimo hace `GET /gallery`
- THEN el sistema responde 200 con `[]`

#### Scenario: Galería con 6 items en orden ASC
- DADO 6 filas con `orden = 1..6` (mezcla de activos e inactivos)
- CUANDO un visitante hace `GET /gallery`
- THEN la respuesta es 200 con 6 items ordenados por `orden` ASC (1, 2, 3, 4, 5, 6)

---

### REQ-HGAL-020 — `POST /gallery` admin (MUST)

El backend DEBE exponer `POST /gallery` (requiere `Depends(get_current_user)`) que crea un nuevo item y responde 201 con el item creado. El endpoint DEBE rechazar `orden` fuera de 1..6 (422), `orden` duplicado entre filas activas (409 con detalle `orden_conflict`), y requests sin auth (401).

#### Scenario: Crear slot nuevo
- DADO un admin autenticado y slots 1..5 ya creados
- CUANDO envía `POST /gallery` con `orden = 6`, `image_url`, `alt_text` válidos
- THEN el sistema responde 201 con el item creado
- Y `GET /gallery` ahora devuelve 6 items

#### Scenario: Conflicto de orden entre activos
- DADO un slot activo con `orden = 3` y un slot inactivo con `orden = 4`
- CUANDO un admin autenticado envía `POST /gallery` con `orden = 3`
- THEN el sistema responde 409 con detalle `orden_conflict`
- Y el slot inactivo con `orden = 4` no se ve afectado por la validación (la unicidad sólo aplica entre activos)

#### Scenario: Auth requerida
- DADO un visitante anónimo
- CUANDO hace `POST /gallery`
- THEN el sistema responde 401

---

### REQ-HGAL-021 — `PATCH /gallery/{id}` admin (MUST)

El backend DEBE exponer `PATCH /gallery/{id}` (requiere `Depends(get_current_user)`) que aplica `model_dump(exclude_unset=True)` sobre `GalleryItemUpdate` y responde 200 con el item actualizado. Si la actualización provoca un conflicto de `orden` con otro slot activo, DEBE responder 409.

#### Scenario: Editar alt_text y link_url preserva el resto
- DADO un slot existente con id = 1
- CUANDO el admin autenticado envía `PATCH /gallery/1` con `{alt_text: "Diseño francés", link_url: "https://instagram.com/p/abc"}`
- THEN el sistema responde 200 con el item actualizado
- Y los campos no enviados (`image_url`, `orden`, `activo`) permanecen inalterados

#### Scenario: PATCH a id inexistente
- DADO un admin autenticado
- CUANDO hace `PATCH /gallery/9999`
- THEN el sistema responde 404

---

### REQ-HGAL-022 — `DELETE /gallery/{id}` admin (MUST)

El backend DEBE exponer `DELETE /gallery/{id}` (requiere `Depends(get_current_user)`) que elimina el item y responde 204. La eliminación es hard delete — el slot `orden` queda libre y `seed_default_gallery` no lo recrea (la seed es idempotente y solo se ejecuta si la tabla está vacía).

#### Scenario: Eliminar slot existente o id inexistente
- DADO un slot existente con id = 1
- CUANDO el admin autenticado hace `DELETE /gallery/1`
- THEN el sistema responde 204
- Y `GET /gallery` ya no incluye ese item
- Y si se hace `DELETE /gallery/9999` (id inexistente) responde 404

---

### REQ-HGAL-030 — Render público: CSS Grid (MUST)

La página Home DEBE renderizar la galería como un CSS Grid con `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` (mismo patrón que `.service-grid` en `frontend/src/index.css:227`). El grid DEBE renderizar hasta 6 `<figure>` con `<img>` y un `<figcaption>` opcional. Cada `<img>` DEBE tener `loading="lazy"`, `decoding="async"`, `width` y `height` explícitos (computados desde el aspect ratio de la imagen o un default 1:1) y `alt={alt_text}` (obligatorio, sin `alt=""`).

#### Scenario: Render con 6 items activos
- DADO 6 items activos con `alt_text` válido
- CUANDO el visitante abre la Home
- THEN la sección "Galería" muestra 6 `<figure>` en el grid
- Y cada `<img>` tiene `loading="lazy"` y `alt` igual al `alt_text` del item

#### Scenario: Atributos width/height previenen CLS
- DADO 6 items con `image_url` apuntando a imágenes externas
- CUANDO la Home renderiza
- THEN cada `<img>` tiene atributos `width` y `height` explícitos (no 0/0)
- Y el layout no salta tras la carga de cada imagen (Lighthouse CLS < 0.1)

---

### REQ-HGAL-031 — Click behavior data-driven (MUST)

El click sobre una imagen DEBE navegar a `link_url` en pestaña nueva (`target="_blank"`, `rel="noopener noreferrer"`) si `link_url` está seteado, o abrir el lightbox si `link_url` es null. La decisión de qué wrapper usar (`<a>` vs `<button>`) DEBE ser data-driven — no se permiten links hardcodeados en código. La `link_url` es config-driven (no del array `isContactUrl()`), porque apunta a URLs arbitrarias elegidas por la manicurista — esta excepción está documentada en el proposal (riesgo #10).

#### Scenario: Con o sin link_url navega o abre lightbox
- DADO un item A con `link_url = "https://instagram.com/p/abc"` y un item B con `link_url = null`
- CUANDO el visitante hace click sobre A
- THEN el navegador abre `https://instagram.com/p/abc` en pestaña nueva con `rel="noopener noreferrer"`
- CUANDO el visitante hace click sobre B
- THEN se abre el lightbox (REQ-HGAL-040) sin navegación

---

### REQ-HGAL-040 — Lightbox: modal accesible (MUST)

El lightbox DEBE ser un componente custom sin librerías de terceros. DEBE tener `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apuntando a un heading oculto que contiene el `alt_text`. DEBE cerrarse con Escape, click fuera de la imagen, o click en el botón "Cerrar". Al abrir, el foco DEBE moverse al botón de cierre. Al cerrar, el foco DEBE volver al thumbnail que abrió el lightbox. DEBE respetar `prefers-reduced-motion: reduce` desactivando la transición de apertura/cierre. DEBE bloquear el scroll del body (`document.body.style.overflow = 'hidden'`) mientras está abierto. El foco DEBE cicléa entre los elementos internos con Tab/Shift+Tab.

#### Scenario: Escape cierra, foco vuelve al trigger y body scroll se restaura
- DADO el lightbox abierto (scroll del body bloqueado)
- CUANDO el usuario presiona Escape
- THEN el lightbox se cierra
- Y el scroll del body queda desbloqueado (`document.body.style.overflow` vuelve a su valor previo)
- Y el foco vuelve al `<button>` thumbnail que abrió el lightbox

#### Scenario: aria-modal, role=dialog y focus trap activos
- DADO el lightbox abierto
- CUANDO un lector de pantalla inspecciona el DOM Y el usuario presiona Tab varias veces
- THEN el contenedor tiene `role="dialog"` y `aria-modal="true"` Y `aria-labelledby` apunta al heading con el `alt_text`
- Y el foco cicléa entre los elementos internos (botón cerrar, imagen) sin escapar al overlay

#### Scenario: prefers-reduced-motion desactiva transición
- DADO el sistema operativo con `prefers-reduced-motion: reduce` activo
- CUANDO el lightbox abre/cierra
- THEN la transición CSS tiene `duration: 0.01ms` (heredado de la regla global en `index.css:128-136`)

---

### REQ-HGAL-050 — UI admin: panel `Galería de Trabajos` (MUST)

El panel admin DEBE añadir un sexto `<details>` collapsible titulado "Galería de Trabajos" entre "Servicios" y "Configuración del negocio", siguiendo el patrón existente de `Admin.tsx` (`COLLAPSIBLE_IDS` línea 60). El collapsible DEBE persistir su estado de abierto/cerrado en `localStorage` con la misma clave que los otros collapsibles.

#### Scenario: Collapsible aparece en el panel
- DADO un admin autenticado en `/admin`
- CUANDO la página renderiza
- THEN existe un `<details>` con id `galeria` y título "Galería de Trabajos"
- Y está colocado entre los collapsibles de "Servicios" y "Configuración del negocio"

---

### REQ-HGAL-051 — Slots editables (1..6) (MUST)

El panel admin DEBE renderizar 6 editores de slot, uno por cada `orden` (1..6), pre-seedeados por `seed_default_gallery` con `activo = false`. Cada editor DEBE incluir: input para `image_url` (con preview thumbnail inline cuando la URL es válida y responde 2xx), input para `alt_text` (con contador de caracteres, obligatorio), input opcional para `link_url` (placeholder `https://...`, con affordance "sin link" para `null`), y toggle `activo`. Cada slot DEBE tener botones "Guardar" (PATCH) y "Eliminar" (DELETE, con confirm).

#### Scenario: Edición de slot con preview de imagen
- DADO un slot con `image_url` vacío
- CUANDO el admin pega `https://cdn.example.com/foto.jpg` y espera 300 ms
- THEN el preview thumbnail muestra la imagen
- Y el botón "Guardar" queda habilitado (URL válida, alt_text no vacío)

#### Scenario: alt_text vacío bloquea Guardar y Eliminar pide confirm
- DADO un slot con `image_url` válido pero `alt_text` vacío
- CUANDO el admin intenta "Guardar"
- THEN el botón está deshabilitado o el cliente rechaza antes del fetch con mensaje inline "Alt text es obligatorio"
- Y si el admin hace click en "Eliminar" de otro slot, se muestra un confirm "Eliminar este slot?" y el DELETE sólo se ejecuta tras confirmar

---

### REQ-HGAL-052 — Botón "Nuevo slot" (MUST)

El panel admin DEBE tener un botón "+ Nuevo slot" que ejecute `POST /gallery` con el próximo `orden` libre (entre 1 y 6). El botón DEBE estar deshabilitado cuando ya existen 6 slots. Tras crear el slot, el nuevo editor aparece en la posición del `orden` correspondiente.

#### Scenario: 6 slots existentes bloquean "+ Nuevo slot"
- DADO 6 slots (órdenes 1..6)
- CUANDO el admin visualiza el panel
- THEN el botón "+ Nuevo slot" está deshabilitado

#### Scenario: Crear slot 4 con slots 1, 2, 3, 5, 6 existentes
- DADO slots en órdenes 1, 2, 3, 5, 6
- CUANDO el admin hace click en "+ Nuevo slot"
- THEN el sistema crea un slot con `orden = 4` y su editor aparece en esa posición

---

### REQ-HGAL-060 — Fallback de imagen rota (MUST)

Si el `<img>` dispara `onError` (URL rota, 404, hotlink expirado), el componente DEBE reemplazar la imagen por un placeholder neutral mostrando el texto "Imagen no disponible" en itálica — no un icono de imagen rota estándar. El fallback DEBE aplicarse tanto en el grid público como en el lightbox. El fallback es puramente visual: el item sigue marcado como activo y la data no se modifica.

#### Scenario: Imagen rota en grid y lightbox muestra fallback
- DADO un item activo con `image_url` apuntando a un 404
- CUANDO el visitante abre la Home
- THEN el `<figure>` del grid muestra el texto "Imagen no disponible" en lugar del icono roto
- Y al abrir el lightbox sobre ese item, el área de la imagen muestra el mismo texto
- Y el `alt_text` original sigue siendo accesible para lectores de pantalla
