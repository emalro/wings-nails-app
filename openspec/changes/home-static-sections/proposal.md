# Proposal: `home-static-sections` (re-scoped)

**Change**: `home-static-sections` | **Phase**: propose (re-run, second pass) | **Strict TDD**: ACTIVE for backend
**Branch strategy**: 4 chained PRs against tracker `feat/home-static-sections` from `origin/main`
**Replaces**: the prior frontend-only `proposal.md` + `specs/` (deleted; obsoleted by the re-scope to admin-configurable gallery with backend persistence)
**Source TODO**: Engram #258 (original TODO), #336 (prior exploration, now superseded), #337 (prior proposal, now superseded)

---

## Intent

**What's broken or missing today**

- The Home page (`frontend/src/pages/Home.tsx`, 191 LOC) renders **5 inline sections**: Hero → Servicios → Conectemos → CTA → Ubicación. There is no Galería, no Sobre mí, no Cómo reservar, no Testimonios, no FAQ. The narrative goes from "what we sell" straight to "where to find us" — the studio's identity, the booking steps, and social proof are absent.
- `REQUIREMENTS.md:41` mandates *"Sección de Trabajos Realizados (Carrusel): Slider de imágenes interactivo y responsive"*. The Carrusel has never been built (12 sections marked ✅ in the index; the gallery is not one of them). It is a documented gap, not a working feature.
- The brand identity is a generic icon (`<GiAngelWings />` in `App.tsx:114`) and a 3.6 MB unoptimized PNG sitting in `static/assets/` — neither is referenced by the React app. `frontend/index.html` has no favicon, no `apple-touch-icon`, no `og:image`.
- The admin has zero surface to manage gallery content. The only way to change a business detail is to edit `Configuracion` (a flat single-row table, `models.py:97-106`).

**What this change adds**

- One **new domain aggregate** — `Galería` (Trabajos Realizados) — managed by the admin (6 image slots with image URL, alt text, optional link, order, active toggle), persisted in a new `GalleryItem` SQLModel table, exposed via 4 new HTTP endpoints (1 public GET + 3 admin CRUD).
- **5 new public Home sections** in a fixed order: Galería → Sobre mí → Cómo reservar → Testimonios → FAQ, expanding the page from 5 to 10 sections. Three sections (Sobre mí, Cómo reservar, Testimonios) plus the gallery copy are content-only and contain no new endpoints.
- A **lightweight custom lightbox** (no library) for gallery images that have no `link_url`, with keyboard close (Escape) and a11y (`role="dialog"`, `aria-modal="true"`, focus trap).
- A **brand shell** — extract `Navbar.tsx` from inline `App.tsx:111-216`, swap the icon for an optimized logo, add multi-resolution favicons and an `apple-touch-icon`.
- A `REQUIREMENTS.md` sync: §2.A.4 changes from "Carrusel" to "Grid de 6" (a11y-justified), and the four new sections are documented as not-yet-implemented business intent.

**Why now**

The studio is going to production. The current Home is a one-trick-pony sales page without identity, social proof, or onboarding. The brand-voice gap, the missing favicon (Lighthouse penalty), and the 3.6 MB logo in the repo (would balloon bundle if anyone ever imports it) are all blockers for a credible launch.

---

## Scope

### In Scope
- **Backend**: 1 new SQLModel (`GalleryItem`, `table=True`) in `backend/app/models.py`; 4 Pydantic schemas in `schemas.py`; 4 new endpoints in `main.py` (public `GET /gallery` + admin `POST /gallery`, `PATCH /gallery/{id}`, `DELETE /gallery/{id}`); 1 idempotent `seed_default_gallery()` registered in `lifespan`; 1 new test file with ≥10 pytest cases.
- **Public frontend**: 5 new section components (`GallerySection`, `AboutMeSection`, `HowToBookSection`, `TestimonialsSection`, `FaqSection`) in `frontend/src/components/public/`; a `Lightbox` modal inlined in `GallerySection`; `Home.tsx` extended from 5 to 10 sections; new CSS in `index.css` (`@layer components`); `useGallery` hook; `api.ts` +2 functions; `vite.config.ts` proxy addition.
- **Admin frontend**: new `frontend/src/components/admin/GallerySection.tsx` (CRUD-with-list mirroring `ServicesSection`); admin hooks for create/update/delete; `Admin.tsx` adds a 6th collapsible `<details>` "Galería de Trabajos" between "Servicios" and "Configuración del negocio".
- **Brand shell**: new `frontend/src/components/layout/Navbar.tsx` extracted from `App.tsx`; new binary assets in `frontend/public/` (`logo.png` optimized, multi-res favicon set); `frontend/index.html` head gets 3 favicon links.
- **Docs**: `REQUIREMENTS.md:41` and §2.A list update (in PR 2); `ARCHITECTURE.md:27` adds the `Galería` aggregate (in PR 1 alongside the model).
- **Process gate**: user voice review of orchestrator-drafted copy (Sobre mí, Testimonios, FAQ) before verify passes.

### Out of Scope (deferred or explicitly rejected)
- **Carousel pattern** — replaced by grid for a11y (WCAG 2.2.2 — moving content without user control). The "Carrusel" wording in `REQUIREMENTS.md:41` is inverted to "Grid" with explicit user sign-off.
- **File upload service** — admin pastes external URLs (e.g., from a CDN, Instagram, Cloudinary). No S3/Supabase storage, no `multipart/form-data` endpoint, no proxying. Trade-off documented in the admin UI as a hint.
- **Third-party social widgets** — no `react-instagram-embed`, no `react-facebook-embed`, no YouTube/Vimeo. The gallery uses plain `<img>` tags only.
- **Image optimization pipeline at runtime** — the optimize step is a one-off script in PR 4 (operates on the source PNG at `static/assets/`). No `sharp`, no `vite-imagetools`, no responsive `srcset`. The admin is responsible for pre-sizing.
- **Admin-editable FAQ / Testimonials / Sobre mí copy** — copy is hardcoded in the component files. Admin can request copy changes via a separate (future) change.
- **Anchor nav / smooth-scroll to sections** — explicit no. Navbar stays as-is (Reservar CTA + socials). The home page has no "jump to Sobre mí" links.
- **Brand fonts** — keep the existing `Playfair Display` + `Plus Jakarta Sans` (loaded in `index.html`). The visual refresh for headings is already in place; this change does not touch typography tokens.
- **Token system / naming refactor** — the `--muted` / `--border` aliases in `index.css:68-74` stay. That refactor is its own change.
- **PostgreSQL-specific migrations** — the project is on SQLite locally + Postgres in prod. `SQLModel.metadata.create_all` covers both for new tables.

---

## Capabilities

### New Capabilities
- `home-gallery`: admin-configurable image gallery (6 slots) with public grid rendering and lightbox on click. Owns the `GalleryItem` aggregate and its HTTP surface. Delta spec at `openspec/changes/home-static-sections/specs/home-gallery/spec.md`; archive phase promotes to `openspec/specs/home-gallery/spec.md`. Carries REQ-HMG-001..008.
- `home-static-content`: the four content-only sections (Sobre mí, Cómo reservar, Testimonios, FAQ) that are pure frontend — no new endpoints, no schemas. Delta spec at `openspec/changes/home-static-sections/specs/home-static-content/spec.md`; archive promotes to `openspec/specs/home-static-content/spec.md`. Carries REQ-HSC-001..005.

### Modified Capabilities
- `online-booking` (existing, `openspec/specs/online-booking/spec.md`): §2.A.4 reference changes from "Carrusel" to "Grid" — a behavioural requirement change, not an implementation detail. Delta spec at `openspec/changes/home-static-sections/specs/online-booking/spec.md`. Carries REQ-BKG-006.

---

## User Flow

### Public visitor (unauthenticated)
1. Lands on `/`. Hero is unchanged.
2. Scrolls past Servicios (now ≤ 3 cards in bento layout).
3. **Galería** (NEW): sees a 3×2 CSS Grid of 6 images with `loading="lazy"`. Clicking an image with a `link_url` opens a new tab; clicking one without opens the custom lightbox. Lightbox: Escape closes, focus is trapped, `aria-modal="true"`, body scroll locked.
4. **Sobre mí** (NEW): 2-3 short paragraphs, first-person, warm tone.
5. **Cómo reservar** (NEW): 3-4 numbered steps mirroring the `/reservar` flow. Final step has a "Reservar Turno" button → `/reservar`.
6. **Testimonios** (NEW): 3 testimonial cards (name, quote, optional role).
7. **FAQ** (NEW): accordion (4-5 Q&A), `<details>`/`<summary>` single-open pattern, native a11y.
8. Existing Conectemos → CTA → Ubicación flow continues unchanged.
9. Navbar (PR 4) now shows the optimized logo PNG in place of the `<GiAngelWings />` icon. Page title and favicon reflect the brand.

### Admin (authenticated)
1. Logs in to `/admin`, scrolls to the new "Galería de Trabajos" collapsible (between "Servicios" and "Configuración del negocio").
2. Sees 6 pre-seeded inactive slots (1..6). Edits slot 1: pastes an image URL, types alt text, optionally pastes a link URL, toggles active, clicks "Guardar". Repeat for slots 2-6.
3. The `useGallery` query key is invalidated on every admin save; the public Home reflects changes on next page load (TanStack Query default).
4. Order is fixed 1..6 (one per `orden` value). If the admin wants to swap slot 3 and slot 5, they edit each individually (no drag-and-drop; out of scope).

---

## Approach

### Data model (PR 1, locked: Approach A)

**`GalleryItem(SQLModel, table=True)`** in `backend/app/models.py` — new class, mirrors the `ClienteTelefono` aggregate pattern (`models.py:34-40`):

| Field | Type | Constraints |
|---|---|---|
| `id` | `Optional[int]` | `primary_key=True, default=None` |
| `orden` | `int` | `unique=True, ge=1, le=6` (the slot number) |
| `image_url` | `str` | mandatory, validated as URL by Pydantic |
| `alt_text` | `str` | mandatory, `min_length=1, max_length=200` |
| `link_url` | `Optional[str]` | optional URL, null means "use lightbox" |
| `activo` | `bool` | `default=False` (admin enables per-slot) |

**Why standalone, not in `Configuracion`**: `/config` is intentionally a single-row flat table (scalar fields only, `models.py:97-106`). Bolting a list onto it would violate that contract. The `ClienteTelefono` peer pattern (child table of `Cliente`) is the right shape. Cost: one extra `useQuery` in `Home.tsx` — trivial. Benefit: type-safe per-row Pydantic, trivial admin CRUD, no JSON column migration story.

### Pydantic schemas (PR 1)

In `backend/app/schemas.py`:
- `GalleryItemRead(BaseModel)` — `ConfigDict(from_attributes=True)`, all 6 fields, `id` + `orden` (no `field_serializer`; URLs are plain strings).
- `GalleryItemCreate(BaseModel)` — `orden`, `image_url`, `alt_text`, `link_url`, `activo`. Validators: `image_url` and `link_url` use `HttpUrl` (rejecting `file://`, garbage). `alt_text` is `min_length=1`. `orden` is `ge=1, le=6, unique` (uniqueness is enforced at DB level too via `Field(unique=True)` on the model).
- `GalleryItemUpdate(BaseModel)` — all fields `Optional` for partial updates. `image_url` and `link_url` use `Optional[HttpUrl]` with the same validation; `orden` cannot be changed (admin edits each slot by id, the `orden` is set on first create and stays).
- Reuse the existing `normalize_phone`-style validators pattern (`schemas.py:41-54`).

### Endpoints (PR 1, in `backend/app/main.py`)

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/gallery` | public | Returns list of 6 items ordered by `orden`. Always returns all 6 slots (inactive included — the public response hides them, see Open Question #1 below). |
| `POST` | `/gallery` | admin | Creates one item. Admin pattern matches `POST /services` (`main.py:962-968`). |
| `PATCH` | `/gallery/{id}` | admin | Partial update. Admin pattern matches `PATCH /services/{id}` (`main.py:971-984`). |
| `DELETE` | `/gallery/{id}` | admin | Hard delete (not soft — gallery is admin-managed content, no audit history needed). |

`POST /gallery` enforces `orden` 1..6 and `unique=True` on the DB. `DELETE` returns 204 (matches `DELETE /services/{id}` pattern, `main.py:987-997`).

### Migration (PR 1, locked: no manual migration)

**Adding a new SQLModel `table=True` class is a no-op for migrations**: `SQLModel.metadata.create_all(engine)` in `backend/app/database.py:30` is called from `lifespan` (`main.py:173`) BEFORE `run_migration` and is non-destructive (it issues `CREATE TABLE IF NOT EXISTS`). The new `GalleryItem` table materializes on next startup automatically. The custom `run_migration()` (`main.py:93-127`) is for ALTER TABLE only and is NOT used here.

A new `seed_default_gallery(session)` function is registered in the lifespan list (`main.py:174`) following the `seed_default_schedule` pattern (`main.py:49-70`) — idempotent, creates 6 inactive rows with `orden=1..6` on first run only.

### Admin UI (PR 3, locked: Approach B — new `GallerySection.tsx`)

Mirrors `ServicesSection.tsx` (178 LOC, `frontend/src/components/admin/ServicesSection.tsx`): 6 slot editors rendered as a vertical list (or a 2-column DataTable). Each slot row has:
- `orden` label (read-only — fixed 1..6)
- `image_url` input + small thumbnail preview (debounced fetch, ~30 LOC extra)
- `alt_text` input (mandatory, marked with `*`)
- `link_url` input (optional, placeholder "https://...")
- `activo` toggle (checkbox)
- "Guardar" + "Eliminar" buttons per row

Wired into `Admin.tsx` as a 6th `<details>` collapsible between "Servicios" and "Configuración del negocio". The `COLLAPSIBLE_IDS` array (`Admin.tsx:60`) gains `'galeria'`.

### Public rendering (PR 2, locked: CSS Grid + custom lightbox)

`GallerySection.tsx` uses `display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` — the exact pattern from `.service-grid` (`index.css:227`). Reuses `.section` / `.section-header` / `.overline` classes (`index.css:218-224`).

Each `<img>` carries: `loading="lazy"`, `decoding="async"`, explicit `width` / `height` (preventing CLS), and the admin's `alt_text`. Click handling: if `link_url` is set, render an `<a target="_blank" rel="noopener noreferrer">`; otherwise render a `<button>` that opens the lightbox.

**Lightbox** lives in `frontend/src/components/public/Lightbox.tsx` (or inlined in `GallerySection.tsx`):
- `<div role="dialog" aria-modal="true" aria-labelledby="lightbox-alt">` wrapping a centered `<img>` + a "Cerrar" button + a backdrop `<button>`.
- Escape key closes (mirror the focus-trap pattern in `App.tsx:53-87`).
- Focus moves to the close button on open; focus returns to the triggering thumbnail on close.
- Body scroll is locked with `document.body.style.overflow = "hidden"` while open; restored on close.
- Honors `prefers-reduced-motion: reduce` (the existing `index.css:128-136` block already nulls transitions).
- 24×24 px minimum target size on the close button (WCAG 2.5.8).

### Brand shell (PR 4)

- Extract `frontend/src/components/layout/Navbar.tsx` (~150 LOC) by moving the block at `App.tsx:111-216`. The mobile drawer, focus trap, and `useAuth` wiring all transfer as-is. `App.tsx` becomes a thin shell (~110 LOC after the cut) that imports `<Navbar />`.
- Replace `<GiAngelWings />` (line 114) with `<img src="/logo.png" alt={businessName} width={36} height={36} className="navbar-brand-logo" />`. The `navbar-brand-logo` class already exists (`index.css:192`) and is a 36×36 round gradient container — fits the use case.
- Binary asset pipeline (one-off script in PR 4, NOT runtime):
  - Source: `static/assets/Gold Vintage Victorian Romantic Frame Wedding Monogram Logo.png` (3.6 MB).
  - Output: `frontend/public/logo.png` (optimized PNG, target <30 KB at 64×64 — run through `oxipng -o max` for lossless; if that misses the budget, lossy `sharp` resize to 64×64).
  - Favicons: `frontend/public/favicon.ico` (multi-resolution 16/32/48 px in one file, target <30 KB), `frontend/public/favicon-32x32.png` (<8 KB), `frontend/public/apple-touch-icon.png` (180×180, <25 KB). Total brand asset budget <50 KB excluding the navbar logo.
- `frontend/index.html:5-9` gains 3 `<link rel="icon">` tags. `<meta name="description">` and `<title>` are unchanged.

### Process gate (PR 2 / verify)

The copy for **Sobre mí** (80-150 words, 2-3 paragraphs), **Testimonios** (3 cards), and **FAQ** (4-5 Q&A) is drafted by the orchestrator in the apply phase with first-person warm tone consistent with the existing brand voice (e.g., the Hero copy: "En {business_name} cada detalle importa"). The user MUST review and approve the copy before verify passes. The orchestrator commits the copy as a separate, easily-revertable commit.

---

## PR Breakdown

> **Constraint reminder**: `openspec/config.yaml:81` sets `review.budget_lines: 400`. The total change is **~1300 LOC** (excluding binary assets). Chained PRs are mandatory. PR 2 is the only PR that exceeds 400 LOC and uses the `size-exception` strategy (user pre-approved in the locked Q&A).
>
> **PR 4 can land in parallel with PR 1** — they touch disjoint file sets (no overlap; PR 1 = backend + tests, PR 4 = Navbar.tsx + public/ + index.html). The orchestrator may start PR 4 as soon as PR 1 is approved, even before PR 1 merges.

### PR 1 — Backend: `GalleryItem` + endpoints + tests

- **Scope**: `backend/app/models.py` (+15), `backend/app/schemas.py` (+55), `backend/app/main.py` (+130 — seed + 4 endpoints + lifespan registration), `backend/app/database.py` (+3 — comment about the create_all contract), `backend/tests/test_gallery.py` (NEW, +180). Adds the `Galería` line to `ARCHITECTURE.md:27` (+5).
- **LOC estimate**: **~390 LOC** (within budget).
- **Depends on**: nothing (off `origin/main`).
- **Work-unit commits** (each ≤150 LOC, TDD red-green-refactor):
  1. `chore(sdd): add GalleryItem SQLModel + ARCHITECTURE.md entry` (model class + doc line, ~30 LOC; no test — model is exercised by the endpoint tests).
  2. `feat(sdd): add gallery Pydantic schemas (RED → GREEN)` (4 schemas in `schemas.py` + 4 schema-only pytests in `test_gallery.py`, ~80 LOC).
  3. `feat(sdd): GET /gallery public endpoint + tests` (endpoint + 3 tests, ~90 LOC).
  4. `feat(sdd): POST /gallery admin endpoint + tests` (endpoint + 3 tests, ~70 LOC).
  5. `feat(sdd): PATCH + DELETE /gallery admin endpoints + tests` (2 endpoints + 4 tests, ~80 LOC).
  6. `chore(sdd): seed_default_gallery in lifespan` (seed fn + lifespan list + 1 test, ~40 LOC).
- **Acceptance criteria**:
  - `python -m pytest` passes; all new tests in `test_gallery.py` green.
  - `GET /gallery` returns 6 items ordered by `orden`, no auth required.
  - `POST /gallery` requires auth (401 without token), validates URL format, rejects `orden` outside 1..6, rejects duplicate `orden` (409).
  - `PATCH /gallery/{id}` partial update, 404 on missing id.
  - `DELETE /gallery/{id}` returns 204.
  - `seed_default_gallery` is idempotent (re-running on a populated DB inserts 0 rows).
- **Verification gate**: `python -m pytest backend/tests/test_gallery.py -v` AND `python -m pytest` (full suite to confirm no regressions).

### PR 2 — Public frontend: 5 new sections + Home rewire + docs

- **Scope**: `frontend/src/components/public/GallerySection.tsx` (NEW, +95), `AboutMeSection.tsx` (NEW, +35), `HowToBookSection.tsx` (NEW, +55), `TestimonialsSection.tsx` (NEW, +60), `FaqSection.tsx` (NEW, +80), `Lightbox.tsx` (NEW, +50), `Home.tsx` (+60 net — extends 5 sections to 10, uses useGallery), `index.css` (+130), `frontend/src/hooks/useGallery.ts` (NEW, +50), `frontend/src/api.ts` (+40), `frontend/vite.config.ts` (+1), `REQUIREMENTS.md` (+25), `ARCHITECTURE.md` (+3 — home-static-content entry).
- **LOC estimate**: **~680 LOC** (over budget — user pre-approved size-exception). If the user wants the budget enforced, this PR splits into PR 2a (Galería + Home rewire) and PR 2b (the 4 content-only sections) at the cost of one extra merge. The brief is locked: single PR with size-exception.
- **Depends on**: PR 1 (needs the `/gallery` endpoint to exist and return data for the type-check pass).
- **Work-unit commits** (each ≤150 LOC):
  1. `chore(sdd): add useGallery hook + api.ts gallery helpers` (+90 LOC; no UI yet).
  2. `feat(sdd): GallerySection + Lightbox + index.css grid` (+200 LOC; component + lightbox + CSS).
  3. `feat(sdd): extend Home.tsx from 5 to 10 sections` (+60 LOC; reorder, add 5 new sections, no copy yet — use placeholders).
  4. `feat(sdd): AboutMeSection copy + wiring` (+35 LOC).
  5. `feat(sdd): HowToBookSection steps + wiring` (+55 LOC).
  6. `feat(sdd): TestimonialsSection + FaqSection` (+140 LOC combined).
  7. `docs(sdd): sync REQUIREMENTS.md §2.A.4 Carrusel→Grid + new sections` (+25 LOC, plus ARCHITECTURE.md).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Home page renders all 10 sections in the locked order: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación.
  - With 0 active gallery items, the Galería section shows an admin-friendly empty state ("Galería sin imágenes activas por el momento").
  - With 6 active items, the grid shows 6 images with `loading="lazy"`, no CLS (Lighthouse CLS < 0.1).
  - Clicking an image with `link_url` opens it in a new tab with `rel="noopener noreferrer"`.
  - Clicking an image without `link_url` opens the lightbox. Escape closes. Tab is trapped. Body scroll is locked while open.
  - `REQUIREMENTS.md:41` reads "Sección de Trabajos Realizados (Grid de 6)" — the word "Carrusel" no longer appears.
  - Sobre mí has 2-3 paragraphs, 80-150 words total, first-person warm tone.
  - FAQ uses native `<details>`/`<summary>` with a single-open pattern (clicking one closes the others).
- **Verification gate**: `npx tsc --noEmit` + Lighthouse smoke (CLS < 0.1, LCP < 2.5s on a desktop run) + manual screen-reader pass (NVDA or VoiceOver) on the lightbox + user voice review of Sobre mí / Testimonios / FAQ copy.

### PR 3 — Admin frontend: `GallerySection` + hook + Admin wiring

- **Scope**: `frontend/src/components/admin/GallerySection.tsx` (NEW, +200), admin functions added to `useGallery.ts` (+30), admin functions added to `api.ts` (+20), `Admin.tsx` (+35 — adds `'galeria'` to `COLLAPSIBLE_IDS` and a new `<details>` block), `frontend/vite.config.ts` (no change — already has `/gallery` via the proxy from PR 2 if needed; otherwise added here).
- **LOC estimate**: **~285 LOC** (within budget).
- **Depends on**: PR 1 (needs the POST/PATCH/DELETE endpoints).
- **Work-unit commits**:
  1. `chore(sdd): add admin gallery API helpers + useAdminGallery hook` (+50 LOC).
  2. `feat(sdd): GallerySection admin component (create/edit/delete + image preview)` (+200 LOC).
  3. `feat(sdd): wire GallerySection into Admin.tsx collapsible` (+35 LOC).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Admin can see the 6 pre-seeded inactive slots in a list/table.
  - Admin can edit a slot: paste image URL → see thumbnail preview within 500 ms (debounced fetch); type alt text; optionally paste link URL; toggle active; click "Guardar" → 200 from the backend, list refreshes.
  - Admin can delete a slot → 204 from the backend, row disappears.
  - Empty alt text is rejected client-side before the request fires (mirroring the Pydantic 422).
  - The new collapsible opens by default on first visit (matches the existing `false` default for new IDs at `Admin.tsx:64`) and persists in `localStorage` like the other collapsibles.
- **Verification gate**: `npx tsc --noEmit` + manual smoke (login as admin, edit 2 slots, verify they show on the public Home after page reload).

### PR 4 — Brand shell: Navbar extraction + logo + favicons

- **Scope**: `frontend/src/components/layout/Navbar.tsx` (NEW, +150), `frontend/src/App.tsx` (-50 net — replace inline block with `<Navbar />`), `frontend/index.html` (+10 — 3 favicon links), `frontend/public/logo.png` (NEW, binary, <30 KB), `frontend/public/favicon.ico` (NEW, binary, <30 KB), `frontend/public/favicon-32x32.png` (NEW, binary, <8 KB), `frontend/public/apple-touch-icon.png` (NEW, binary, <25 KB).
- **LOC estimate**: **~110 LOC of source code** (binary assets are not counted toward the 400-line budget; this PR is well under).
- **Depends on**: nothing (can land in parallel with PR 1).
- **Work-unit commits**:
  1. `chore(sdd): optimize source logo PNG + emit frontend/public/logo.png` (binary, ~0 source LOC; 1 shell script committed or a build note in DOCUMENTATION.md).
  2. `chore(sdd): emit multi-res favicon set in frontend/public/` (binary).
  3. `feat(sdd): extract Navbar.tsx from App.tsx` (+150 LOC Navbar, -50 LOC App).
  4. `chore(sdd): wire favicon + apple-touch-icon links in index.html` (+10 LOC).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Navbar renders identically to before the refactor (visual regression via the existing manual smoke checklist).
  - Navbar brand shows the new `<img src="/logo.png">` instead of `<GiAngelWings />`.
  - Browser tab shows the new favicon on Chrome + Firefox + Safari (manual).
  - `frontend/public/logo.png` is <30 KB. Total `frontend/public/` binary size (favicon + apple-touch + logo) is <100 KB.
  - Lighthouse "Properly defines `<link rel="icon">`" check passes.
- **Verification gate**: `npx tsc --noEmit` + Lighthouse mobile audit (LCP and CLS unchanged) + visual smoke (navbar looks identical apart from the logo).

### Total estimated LOC across all 4 PRs

| PR | Source LOC | Binary | Files touched | Budget |
|---|---|---|---|---|
| 1 — Backend | ~390 | 0 | 5 | within |
| 2 — Public FE | ~680 | 0 | 12 | **over (size-exception pre-approved)** |
| 3 — Admin FE | ~285 | 0 | 4 | within |
| 4 — Brand shell | ~110 | ~93 KB | 4 source + 4 binary | within |
| **Total** | **~1465** | 4 binary files | 25 | 1 over-budget PR |

### Parallelism

- **PR 4 can start in parallel with PR 1**: disjoint file sets (`backend/app/*` vs `frontend/src/components/layout/*` + `frontend/public/*` + `frontend/index.html` + `frontend/src/App.tsx`).
- **PR 2 must wait for PR 1** (needs the `/gallery` endpoint to type-check against).
- **PR 3 must wait for PR 1** (needs the POST/PATCH/DELETE endpoints).
- **PR 2 and PR 3 are independent of each other** (different components), but both depend on PR 1.

---

## Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **PR 2 overshoots the 400-LOC review budget** by ~70% | High (locked) | Reviewer fatigue, longer PR cycle | User pre-approved `size-exception` in the Q&A round. The 4 micro-commits in PR 2 (work-units 1-7) are each <150 LOC, so a reviewer can stop between any two. The alternative is splitting into 2a (Galería) and 2b (content sections), but that costs an extra merge cycle for marginal reviewer benefit. |
| 2 | **`REQUIREMENTS.md:41` sync drift** (the §2.A.4 change might be missed if PR 2 lands before the docs commit) | Medium | Spec/impl mismatch, audit failure | Work-unit 7 in PR 2 is `docs(sdd): sync REQUIREMENTS.md`. It MUST land last in the PR. The verify phase rechecks the spec text against the rendered Home. |
| 3 | **Brand-voice drift on orchestrator-drafted copy** (Sobre mí, Testimonios, FAQ) | Medium | Sounds AI-generic, breaks the "small studio with a point of view" brand promise | The user MUST review and approve the copy before verify passes (process gate locked in the Q&A). Copy lives in 3 separate, easily-revertable commits (work-units 4-6 in PR 2). If the user rejects, the orchestrator rewrites and re-commits — the rest of PR 2 is unaffected. |
| 4 | **External image hotlink fragility** (admin pastes an Instagram CDN URL, Instagram rotates it, image breaks) | Medium | Broken thumbnails on the public Home, "Lighthouse broken image" penalty | `<img onError>` falls back to a placeholder block (CSS class `gallery-item-fallback` showing the `alt_text` in italic). The admin UI shows a hint: "Use URLs that won't rotate — your own CDN, Cloudinary, Imgur direct links." No automated link checker in v1. |
| 5 | **CLS on unoptimized images** (admin pastes 4 MB high-res URLs) | Medium | Poor Lighthouse score, janky scroll | Mandatory `width` + `height` attributes in the rendered markup (set from admin-provided aspect ratio in the data, OR fixed at 4:3 if admin doesn't specify — proposal defaults to 4:3 to keep the grid tidy). `loading="lazy"`, `decoding="async"`. The admin UI hint recommends pre-sizing to 1200×800. |
| 6 | **Lightbox a11y regression** (focus trap bug, missing `aria-modal`, body scroll not unlocked on close) | Low | Screen-reader users get stuck | Mirror the existing focus-trap pattern in `App.tsx:53-87` (proven correct, used in the mobile drawer). Add Vitest cases for: (a) Escape closes, (b) Tab cycles inside, (c) focus returns to the trigger on close, (d) `aria-modal="true"` is present. `prefers-reduced-motion` already handled by `index.css:128-136`. |
| 7 | **Migration ordering race** (the new `GalleryItem` table doesn't exist when a freshly-deployed instance boots in production for the first time) | Low | 500 on first GET /gallery, transient until next boot | `SQLModel.metadata.create_all` runs BEFORE `run_migration` in the lifespan (`main.py:173-174`). The new table is created on first startup automatically — verified by the public-booking precedent (no `run_migration` call was needed when `/public/clients` was added). Document the contract in a one-line comment in `database.py`. |
| 8 | **Copy approval gate blocks verify indefinitely** (user is busy, copy is in limbo) | Low | Verify stalls, no merge | The copy commits in PR 2 (work-units 4-6) are isolated and revertable. If the user can't review in time, the orchestrator can merge the rest of PR 2 (work-units 1-3, 7) and rebase the copy commits into a follow-up PR after approval. The Home renders fine with placeholder text in the meantime. |
| 9 | **Logo optimization destroys the Victorian filigree** (3.6 MB → <30 KB is a 99% size reduction) | Medium | Brand looks amateur on the navbar | Two-step: `oxipng -o max` lossless first (typically ~50% reduction); if still over 30 KB, lossy `sharp` resize to 64×64 with quality 85 + PNG palette quantization. Visual review before commit — if the filigree is destroyed, fall back to a 128×128 source and accept ~50 KB. |
| 10 | **Admin pastes a `link_url` and forgets `target="_blank"` semantics** (link opens in same tab, user navigates away from the Home) | Low | Bad UX, lost visitor | Always render `<a target="_blank" rel="noopener noreferrer">` in `GallerySection` — `target` is not a per-item field, it's a rendering policy. No way to misconfigure. |
| 11 | **Public-booking precedent gotcha — `response.status_code` override on hit branch** | Very Low | 201 instead of 200 on the existing-active-DNI hit | This is a `public/clients` quirk, not relevant to `GalleryItem` since the public GET is read-only and always returns 200. Noted for awareness only. |

---

## Affected Areas

| File | Action | PR | Description |
|------|--------|----|-------------|
| `backend/app/models.py` | Modify | 1 | Add `GalleryItem` class (+15 LOC). |
| `backend/app/schemas.py` | Modify | 1 | Add 4 Pydantic schemas (+55 LOC). |
| `backend/app/main.py` | Modify | 1 | Add `seed_default_gallery`, register in lifespan, add 4 endpoints (+130 LOC). |
| `backend/app/database.py` | Modify | 1 | One-line comment documenting the create_all contract (+3 LOC). |
| `backend/tests/test_gallery.py` | New | 1 | ~10-12 pytest cases (+180 LOC). |
| `ARCHITECTURE.md` | Modify | 1, 2 | `Galería` aggregate bullet (PR 1) + `home-static-content` bullet (PR 2) (+8 LOC). |
| `frontend/src/components/public/GallerySection.tsx` | New | 2 | Public gallery section with lightbox (~95 LOC). |
| `frontend/src/components/public/Lightbox.tsx` | New | 2 | Modal with focus trap (~50 LOC). |
| `frontend/src/components/public/AboutMeSection.tsx` | New | 2 | Static copy section (~35 LOC). |
| `frontend/src/components/public/HowToBookSection.tsx` | New | 2 | Numbered steps + CTA (~55 LOC). |
| `frontend/src/components/public/TestimonialsSection.tsx` | New | 2 | 3 testimonial cards (~60 LOC). |
| `frontend/src/components/public/FaqSection.tsx` | New | 2 | Accordion with single-open pattern (~80 LOC). |
| `frontend/src/pages/Home.tsx` | Modify | 2 | Extend from 5 to 10 sections, add `useGallery` (+60 net LOC). |
| `frontend/src/hooks/useGallery.ts` | New | 2, 3 | Public `useGallery` (PR 2) + admin mutations (PR 3) (+80 LOC total). |
| `frontend/src/api.ts` | Modify | 2, 3 | Public `getGallery` (PR 2) + admin CRUD helpers (PR 3) (+60 LOC). |
| `frontend/src/index.css` | Modify | 2 | `.gallery-grid`, `.gallery-item`, `.faq-item`, `.testimonial-card`, lightbox styles (+130 LOC). |
| `frontend/vite.config.ts` | Modify | 2 | Add `'/gallery': 'http://localhost:8000'` to dev proxy (+1 LOC). |
| `REQUIREMENTS.md` | Modify | 2 | §2.A.4 Carrusel→Grid, add 4 new sections (+25 LOC). |
| `frontend/src/components/admin/GallerySection.tsx` | New | 3 | Admin CRUD with list (~200 LOC). |
| `frontend/src/pages/Admin.tsx` | Modify | 3 | Add `'galeria'` to `COLLAPSIBLE_IDS` + new `<details>` block (+35 LOC). |
| `frontend/src/components/layout/Navbar.tsx` | New | 4 | Extract from `App.tsx` (~150 LOC). |
| `frontend/src/App.tsx` | Modify | 4 | Replace inline navbar with `<Navbar />` import (-50 net LOC). |
| `frontend/index.html` | Modify | 4 | 3 favicon `<link>` tags in `<head>` (+10 LOC). |
| `frontend/public/logo.png` | New (binary) | 4 | Optimized logo, target <30 KB. |
| `frontend/public/favicon.ico` | New (binary) | 4 | Multi-res 16/32/48, target <30 KB. |
| `frontend/public/favicon-32x32.png` | New (binary) | 4 | Target <8 KB. |
| `frontend/public/apple-touch-icon.png` | New (binary) | 4 | 180×180, target <25 KB. |
| `DOCUMENTATION.md` | Modify | 1, 2, 3, 4 | One changelog entry per PR on phase completion. |

---

## Open Questions

1. **What does the public `GET /gallery` return when no items are active?** — Three options: (a) return all 6 items with `activo: false` and let the frontend filter; (b) return only the active ones; (c) return all 6 with `activo` and the frontend renders a placeholder for inactive slots. **Recommendation: (a)** — the frontend filters and the section shows an empty-state message ("Galería sin imágenes activas por el momento"). Simpler than (b) (which would let the admin check active count by counting items) and the 6-row response is bounded.
2. **What happens to inactive items in the admin UI?** — All 6 always show (inactive grayed out), with the toggle per row. The admin can never accidentally lose a slot by toggling active.
3. **Default `alt_text` when the admin leaves it blank** — strictly reject at the Pydantic level (`min_length=1`). Admins fight it once, then comply. Better than 6 broken `<img alt="">` lines. The empty-state error message in the admin form points to the field.
4. **`orden` is fixed at 1..6 (no add/remove). What if the admin wants fewer than 6?** — They leave the unused slots inactive. The frontend's CSS Grid fills the row with `repeat(auto-fill, minmax(280px, 1fr))`, so 4 items show as 4 cells in a 2×2 layout. No special handling.
5. **Aspect ratio policy for the grid** — admin can paste any aspect ratio. **Recommendation**: the frontend CSS uses `object-fit: cover; aspect-ratio: 4/3;` to normalize. If the admin pastes a 16:9 image, it gets cropped slightly (acceptable; the alternative — ugly gaps — is worse). The admin UI hints at 4:3 or 1:1 for best results.
6. **Gallery image preview in the admin** — debounced fetch (300 ms) of the URL to render a 60×60 thumbnail next to the input. Worth the ~30 LOC? **Recommendation: yes** — without it, the admin can't tell a typo'd URL from a working one until they reload the public Home.
7. **FAQ single-open vs multi-open accordion** — single-open (clicking one closes the others) is the more polished UX. **Recommendation: single-open** via a small `useState<number | null>` in `FaqSection.tsx`. ~10 LOC.
8. **Testimonials source** — fabricated (the studio has no public testimonials yet) or marked as "sample" / "example"? **Recommendation: clearly mark as "Ejemplo" or "Testimonio"** in the card so visitors know they're representative. User can swap to real copy in a follow-up.

---

## Success Criteria

- [ ] All 4 PRs merged to `feat/home-static-sections`; the tracker merges to `origin/main` last.
- [ ] `python -m pytest` green (no regressions; all new gallery tests pass).
- [ ] `npx tsc --noEmit` clean (no TS errors introduced).
- [ ] Public Home renders all 10 sections in the locked order: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación.
- [ ] Admin can CRUD all 6 gallery slots: create new, edit existing, delete, toggle active, see thumbnail preview.
- [ ] Gallery grid renders 6 images with `loading="lazy"`, no CLS (Lighthouse CLS < 0.1).
- [ ] Lightbox is keyboard-accessible: Escape closes, Tab cycles inside, focus returns to the trigger on close, `aria-modal="true"` is present.
- [ ] `REQUIREMENTS.md:41` reads "Sección de Trabajos Realizados (Grid de 6)" — the word "Carrusel" no longer appears in the gallery section.
- [ ] Navbar shows the new optimized logo (not the `<GiAngelWings />` icon).
- [ ] Browser tab shows the new favicon in Chrome + Firefox + Safari.
- [ ] Lighthouse "Properly defines `<link rel="icon">`" check passes.
- [ ] `frontend/public/` binary size (logo + favicons) is <100 KB total.
- [ ] User voice review of orchestrator-drafted copy (Sobre mí, Testimonios, FAQ) approved and committed.

---

## Rollback

- **Each PR is independently revertable.** `git revert <merge-sha>` on the tracker branch undoes one PR cleanly.
- **PR 1 is additive only.** The new `GalleryItem` table is created by `create_all`; reverting PR 1 drops no existing data (the table is new). If a future migration ever adds ALTER on this table, the revert removes the migration call but the table persists (no data loss, just orphaned).
- **PR 2 reverts the Home to the 5-section layout** in `Home.tsx`. The new section components and CSS classes are unused but harmless. `REQUIREMENTS.md` rolls back to the old "Carrusel" text.
- **PR 3 reverts the admin `<details>` collapsible**. The `GallerySection` component and its admin hook are unused but harmless.
- **PR 4 reverts to inline `App.tsx` navbar + the old `<GiAngelWings />` icon**. The optimized binary assets in `frontend/public/` stay (no harm; if the user wants them gone, a follow-up `git rm` commit cleans up).
- **The tracker branch `feat/home-static-sections` is the rollback point.** If everything goes wrong, the tracker can be abandoned and `main` is unaffected.
