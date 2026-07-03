# Delta Spec: `home-static-content` (NEW capability)

**Change**: `home-static-sections`
**Capability**: `home-static-content` (new — covers 4 frontend-only static sections PLUS the brand shell)
**Source artifacts**: `openspec/changes/home-static-sections/exploration.md`, `proposal.md`
**Type**: ADDED (new capability; no prior `home-static-content` spec exists)
**Strict TDD**: NOT ENFORCED (frontend has no test runner — `tsc --noEmit` is the type-checker of record)
**Locked decisions referenced**: 4 content-only sections (Sobre mí, Cómo reservar, Testimonios, FAQ), process gate for orchestrator-drafted copy, brand shell (Navbar extraction + logo + favicons) is cross-cutting and lives in this spec.

---

## Purpose

`home-static-content` covers the four pure-frontend, no-new-endpoints sections of the Home page (Sobre mí, Cómo reservar, Testimonios, FAQ) plus the cross-cutting brand shell (Navbar component extraction, optimized logo PNG, multi-resolution favicons, `index.html` head links). The capability also defines the process gate for orchestrator-drafted copy and the brand-voice review by the user.

The Home page is extended from 5 sections to 10 (see REQ-HSSC-001). Content is inlined in component files — admin-editable copy is explicitly out of scope (deferred to a future change).

---

## Requirements

### REQ-HSSC-001 — Composición de la Home (MUST)

La página Home (`frontend/src/pages/Home.tsx`) DEBE renderizar las 10 secciones en el orden DOM top-to-bottom locked: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación. Las 5 secciones nuevas (Galería — ver `home-gallery`; Sobre mí; Cómo reservar; Testimonios; FAQ) se insertan entre Servicios y Conectemos. Las secciones existentes (Hero, Servicios, Conectemos, CTA, Ubicación) NO cambian su posición ni su contenido.

#### Scenario: Home renderiza 10 secciones en orden
- DADO un visitante en `/`
- CUANDO la Home renderiza
- THEN las 10 secciones aparecen en el DOM en el orden: hero, servicios, galeria, sobre-mi, como-reservar, testimonios, faq, conectemos, cta, ubicacion
- Y las 5 secciones nuevas aparecen entre Servicios y Conectemos

---

### REQ-HSSC-002 — Patrón visual compartido (MUST)

Cada sección nueva DEBE usar el patrón visual de `.section` + `.section-header` + `.overline` + `<h2>` + `<p>` que ya existe en `frontend/src/index.css:218-224`. Cada `<section>` DEBE llevar `aria-labelledby` apuntando al id del `<h2>` interno. Las secciones nuevas DEBEN usar los tokens CSS existentes (`--primary`, `--surface`, `--font-display`, etc.) — no se introducen design tokens nuevos.

#### Scenario: Secciones nuevas cumplen el patrón visual
- DADO las secciones Sobre mí, Cómo reservar, Testimonios, FAQ
- CUANDO la Home renderiza
- THEN cada una tiene `<section className="section" aria-labelledby="...">` con un `<div className="section-header">` interno
- Y el `<h2>` interno tiene `id` que coincide con el `aria-labelledby` del `<section>`

---

### REQ-HSSC-010 — Sobre mí: copy y estructura (MUST)

La sección "Sobre mí" DEBE renderizar 2-3 párrafos cortos en primera persona, tono cálido y cercano, total 80-150 palabras. La copy DEBE ser redactada por el orchestrator en la fase apply, basada en el `business_name` configurado y la voz de marca del Hero actual ("En {business_name} cada detalle importa"). El contenedor DEBE tener `max-width: 720px` para legibilidad. La copy DEBE estar marcada con un comentario `TODO(sdd): user voice review required` visible en el código fuente hasta que el usuario apruebe la redacción (ver REQ-HSSC-060).

#### Scenario: Render con copy aprobada o placeholder
- DADO la sección Sobre mí en `frontend/src/components/public/AboutMeSection.tsx`
- CUANDO la Home renderiza
- THEN la sección muestra 2-3 párrafos en `<p>` dentro de un contenedor con `max-width: 720px`
- Y el archivo fuente contiene un comentario `TODO(sdd): user voice review required` (visible hasta aprobación)

---

### REQ-HSSC-020 — Cómo reservar: pasos numerados (MUST)

La sección "Cómo reservar" DEBE renderizar 3-4 pasos numerados que reflejan el flujo público de reserva (`/reservar`): (1) elegir servicios, (2) completar datos + seleccionar fecha/hora en el calendario, (3) revisar resumen y confirmar, (4) pagar seña por transferencia y enviar comprobante por WhatsApp. El último paso DEBE incluir un botón "Reservar Turno" que navega a `/reservar` (activable con click, Enter o Space). Los pasos DEBEN ser `<ol>` o equivalente semántico.

#### Scenario: Pasos y CTA funcionales
- DADO un visitante en la Home
- CUANDO la sección "Cómo reservar" renderiza
- THEN hay 3-4 `<li>` numerados describiendo el flujo
- Y el último paso contiene un botón "Reservar Turno"
- Y al hacer click (o Enter/Space) sobre el botón, el navegador navega a `/reservar`

---

### REQ-HSSC-030 — Testimonios: 3 cards (MUST)

La sección "Testimonios" DEBE renderizar exactamente 3 cards. Cada card DEBE mostrar: una cita en bloque, y un nombre genérico atribuido (ej: "María L.", "Sofía G."). En viewports ≥ 768px DEBEN mostrarse en 3 columnas; en < 768px DEBEN apilarse verticalmente. La copy DEBE ser redactada por el orchestrator y marcada con `TODO(sdd): user voice review required` (ver REQ-HSSC-060) — el studio no tiene testimonios públicos reales todavía, así que el contenido inicial es representativo y el usuario DEBE aprobarlo.

#### Scenario: Render responsive con 3 cards
- DADO la sección Testimonios en viewport 1024px
- CUANDO renderiza
- THEN se ven 3 cards en 3 columnas (grid)
- Y en viewport 375px, las 3 cards se apilan verticalmente
- Y cada card tiene una cita en bloque y un nombre genérico atribuido

---

### REQ-HSSC-040 — FAQ: accordion accesible (MUST)

La sección "FAQ" DEBE renderizar 4-5 pares Q&A como un accordion de apertura múltiple (cada pregunta se abre/cierra de forma independiente; abrir una NO cierra las demás). DEBE usar `<button>` para el trigger de cada pregunta con `aria-expanded` y `aria-controls` apuntando al id del panel de respuesta. Los paneles DEBEN tener `id` único. El accordion DEBE activarse con click, Enter y Space. DEBE respetar `prefers-reduced-motion: reduce` (la regla global en `index.css:128-136` ya lo cubre). La copy DEBE ser redactada por el orchestrator y marcada con `TODO(sdd): user voice review required` (ver REQ-HSSC-060).

#### Scenario: Apertura múltiple, keyboard a11y
- DADO la sección FAQ con 4 preguntas, todas cerradas inicialmente
- CUANDO el usuario hace click en pregunta 2
- THEN la pregunta 2 abre y las demás siguen cerradas
- Y el `<button>` de pregunta 2 tiene `aria-expanded="true"` y `aria-controls="faq-2-panel"`
- CUANDO el usuario hace click en pregunta 3
- THEN pregunta 2 sigue abierta Y pregunta 3 también abre (apertura múltiple, NO se cierra ninguna)
- Y al presionar Enter o Space sobre un `<button>` cerrado, se abre sin necesidad de click
- Y al presionar Enter o Space sobre un `<button>` abierto, se cierra (toggle)

---

### REQ-HSSC-050 — Brand shell: extracción de Navbar (MUST)

El navbar inline en `frontend/src/App.tsx:111-216` (incluyendo el bloque desktop links, hamburger button, mobile drawer con focus trap, `useAuth` wiring y el brand con `<GiAngelWings />`) DEBE ser extraído a un nuevo archivo `frontend/src/components/layout/Navbar.tsx`. `App.tsx` DEBE quedar como un shell delgado que importa `<Navbar />` y mantiene el footer, FAB de WhatsApp y `<Outlet />`. El comportamiento (focus trap, drawer, social icons) NO cambia — el refactor es puramente estructural.

#### Scenario: Navbar refactor preserva comportamiento
- DADO el refactor aplicado
- CUANDO un visitante navega a `/`, abre el menú mobile y presiona Tab
- THEN el navbar se ve idéntico al pre-refactor
- Y el focus trap del drawer sigue ciclando entre sus elementos
- Y el botón hamburger cierra el drawer con Escape

---

### REQ-HSSC-051 — Brand shell: logo optimizado (MUST)

El icono `<GiAngelWings />` en el brand del navbar (`App.tsx:114`, ahora en `Navbar.tsx`) DEBE ser reemplazado por un `<img src="/logo.png" alt={businessName} width={36} height={36} className="navbar-brand-logo" />`. El archivo `frontend/public/logo.png` DEBE existir, ser 64×64 px (target), y pesar < 30 KB. El PNG fuente en `static/assets/Gold Vintage Victorian Romantic Frame Wedding Monogram Logo.png` (3.6 MB, no servido por FastAPI) NO DEBE ser referenciado desde código de la app — es solo material fuente para la pipeline de optimización one-off.

#### Scenario: Logo PNG referenciado y liviano
- DADO el refactor aplicado
- CUANDO el navbar renderiza
- THEN el brand muestra un `<img src="/logo.png">` con `alt` igual al `business_name`
- Y el archivo `frontend/public/logo.png` existe y pesa < 30 KB
- Y no hay ningún import o referencia a `static/assets/` en el código de la app

---

### REQ-HSSC-052 — Brand shell: favicons multi-resolución (MUST)

`frontend/index.html` DEBE tener 3 `<link rel="icon">` en el `<head>`: uno para `favicon.ico` multi-resolución (16/32/48 px embebidos), uno para `favicon-32x32.png`, y un `<link rel="apple-touch-icon">` para `apple-touch-icon.png` (180×180). Los 3 archivos DEBEN existir en `frontend/public/`. El peso total de los assets binarios en `frontend/public/` (logo + favicon.ico + favicon-32x32.png + apple-touch-icon.png) DEBE ser < 100 KB.

#### Scenario: Favicon links presentes y Lighthouse ok
- DADO el refactor aplicado
- CUANDO el navegador carga la Home
- THEN el `<head>` de `index.html` contiene los 3 `<link rel="icon">` y `<link rel="apple-touch-icon">`
- Y el tab del navegador muestra el favicon
- Y el peso total de `frontend/public/` es < 100 KB
- Y el check de Lighthouse "Properly defines `<link rel="icon">`" pasa

---

### REQ-HSSC-060 — Process gate: review de copy por el usuario (MUST)

Los bloques de copy redactados por el orchestrator (Sobre mí, Testimonios, FAQ) DEBEN pasar por una review de voz de marca del usuario antes de que la fase verify emita un verdict de `pass`. El orchestrator DEBE marcar cada bloque de copy con un comentario visible `TODO(sdd): user voice review required` en el archivo del componente. El reporte de verify DEBE listar el estado de review de cada bloque (Sobre mí / Testimonios / FAQ) y reportar `blocked` (NO `pass`) si alguno está sin confirmar.

#### Scenario: Verify bloqueado si alguna copy está sin review
- DADO los 3 bloques de copy (Sobre mí, Testimonios, FAQ) commiteados con el comentario `TODO(sdd): user voice review required`
- CUANDO el orchestrator corre la fase verify sin confirmación explícita del usuario para ninguno
- THEN el reporte de verify lista los 3 bloques como `pending` y reporta status `blocked` (NO `pass`)

#### Scenario: Verify pasa tras confirmación del usuario
- DADO los 3 bloques commiteados con el `TODO`
- CUANDO el usuario confirma "Sobre mí OK", "Testimonios OK", "FAQ OK" en el chat
- THEN el orchestrator remueve los `TODO` de los archivos
- Y el reporte de verify lista los 3 bloques como `approved` y reporta status `pass`

---

### REQ-HSSC-061 — Aislamiento del process gate (SHOULD)

Los commits de copy de los 3 bloques (Sobre mí, Testimonios, FAQ) DEBEN ser commits separados, cada uno revertible independientemente. Si el usuario rechaza la copy de uno de los bloques, sólo ese commit se revierte — el resto de PR 2 (Galería, Home rewire, Cómo reservar) NO se ve afectado. La Home DEBE renderizar correctamente con copy placeholder mientras los commits están en limbo.

#### Scenario: Rechazo de un bloque afecta sólo ese commit
- DADO PR 2 con commits separados para Sobre mí, Testimonios, FAQ
- CUANDO el usuario aprueba Sobre mí y Testimonios pero rechaza FAQ
- THEN el orchestrator puede reescribir y re-commitear FAQ sin tocar los otros 2 commits
- Y la Home renderiza con la copy aprobada + placeholder en FAQ mientras tanto
