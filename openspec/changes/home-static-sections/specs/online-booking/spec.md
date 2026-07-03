# Delta Spec: `online-booking` (MODIFIED capability)

**Change**: `home-static-sections`
**Capability**: `online-booking` (existing at `openspec/specs/online-booking/spec.md`)
**Source artifacts**: `openspec/changes/home-static-sections/exploration.md`, `proposal.md`
**Type**: ADDED (1 new requirement that formalizes a previously-underspecified section of REQUIREMENTS.md §2.A.4)
**Locked decisions referenced**: `REQUIREMENTS.md:41` "Sección de Trabajos Realizados (Carrusel)" → "Sección de Trabajos Realizados (Grid de 6)". The pattern inversion (carrusel → grid) is a11y-justified per the project's accessibility skill (WCAG 2.2.2 — moving content without user control).

> **Framing note for the archive step**: The proposal labels this change "MODIFIED" because `REQUIREMENTS.md:41` itself is being modified. The formal `online-booking` spec at `openspec/specs/online-booking/spec.md` does NOT currently have a requirement covering the gallery section (it stops at REQ-BKG-005 Privacy Labels). This delta therefore adds REQ-BKG-006 as a NEW requirement that formalizes the spec-side behaviour and inverts the prior Carrusel intent. The full gallery mechanics (admin CRUD, lightbox, slots) live in the new `home-gallery` capability; this delta establishes the user-visible contract for the Home page section.

---

## Purpose

This delta establishes the spec-level contract for the "Sección de Trabajos Realizados" on the public Home page as a 6-slot admin-configurable Grid (no carousel pattern). It links `REQUIREMENTS.md:41` (Carrusel → Grid) to the implementation owned by the new `home-gallery` capability.

---

## ADDED Requirements

### REQ-BKG-006 — Galería de Trabajos Realizados (Grid de 6) (MUST)

La Home DEBE renderizar una sección "Trabajos Realizados" compuesta por un CSS Grid de hasta 6 imágenes administrables. NO DEBE usarse el patrón carrusel (slider con auto-advance): todas las imágenes DEBEN estar visibles simultáneamente en una grilla responsive. La grilla DEBE ser alimentada por items activos del aggregate `GalleryItem` (ver `home-gallery`). La sección DEBE aparecer entre "Servicios" y la siguiente sección del flujo Home. Si no hay items activos, la sección DEBE mostrar un mensaje placeholder ("Galería sin imágenes activas por el momento") en lugar de ocultarse, para que la admin pueda detectar el estado vacío sin tener que entrar al panel.

(Previously: `REQUIREMENTS.md:41` mandated "Sección de Trabajos Realizados (Carrusel): Slider de imágenes interactivo y responsive" — a carousel pattern that violates WCAG 2.2.2 (auto-advancing moving content without user control). The user approved in the proposal Q&A to invert the pattern to a static grid. This requirement formalizes the new behavior in the spec.)

#### Scenario: Grid renderiza items activos
- DADO el aggregate `GalleryItem` con 6 items activos y `alt_text` válido
- CUANDO un visitante abre la Home
- THEN la sección "Trabajos Realizados" muestra 6 imágenes en un CSS Grid (no un slider)
- Y todas las imágenes son visibles simultáneamente (no hay auto-advance)
- Y el patrón carrusel NO se usa (no hay dots de navegación, no hay flechas de "siguiente/anterior")

#### Scenario: Estado vacío muestra placeholder
- DADO el aggregate `GalleryItem` con 0 items activos
- CUANDO un visitante abre la Home
- THEN la sección "Trabajos Realizados" muestra el mensaje "Galería sin imágenes activas por el momento"
- Y la sección NO se oculta (sigue presente en el DOM con `aria-labelledby`)

#### Scenario: Section ordering entre Servicios y la siguiente sección
- DADO la Home renderizada
- CUANDO se inspecciona el DOM
- THEN la sección "Trabajos Realizados" aparece inmediatamente después de `<section id="servicios">` y antes de la siguiente sección (en orden locked: Galería → Sobre mí)
