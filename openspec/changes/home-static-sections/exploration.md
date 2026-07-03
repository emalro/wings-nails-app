# Exploration: `home-static-sections` (re-scoped)

**Change**: `home-static-sections`
**Status**: Explore (re-run, second pass)
**Branch target**: `feat/home-static-sections` from `origin/main`
**Replaces**: the prior `exploration.md` (frontend-only, no gallery admin) AND `proposal.md` AND `specs/` — all obsolete; deleted. The change has been **fundamentally re-scoped** by the user: gallery is now admin-configurable with backend persistence.
**Source TODO**: Engram observation #258 (original TODO) + #336 (prior exploration, now superseded).
**Strict TDD**: ACTIVE for backend (pytest + httpx TestClient in `backend/tests/`). Frontend has no test runner (`tsc --noEmit` is the type-checker of record per `openspec/config.yaml`).

---

## 1. Current State (what's already there)

### Home page
- `frontend/src/pages/Home.tsx` (191 LOC) renders **5 top-level sections in a fixed order**, all inline. No sub-components, no shared section wrapper, no content config layer.
- Order: Hero (`hero`, 27–56) → Servicios (`section#servicios`, 58–106) → Conectemos (`section section-conectemos`, 110–159) → CTA (`cta-section`, 161–167) → Ubicación (`section section-alt`, 169–188).
- Visual convention (used in every section): `<section className="section[ variant]" aria-labelledby="...">` → `<div className="content">` → `<div className="section-header">` with `<span className="overline">` + `<h2>` + `<p>`.
- Services section has the closest pattern to a future gallery: grid (`service-grid`), loading skeleton, error w/ retry, empty state.

### Backend: Configuracion
- `backend/app/models.py:97-106` — `Configuracion` is a **single-row table** (id=1 pattern). Flat scalar fields only. No joins. No nested objects. `business_name`, `facebook_url`, `instagram_url`, `whatsapp_number`, `address`, `cbu_alias`, `cbu_number`.
- `backend/app/schemas.py:215-234` — `ConfiguracionUpdate` / `ConfiguracionRead` mirror the model 1:1. All fields are `Optional[str]` on update.
- `backend/app/main.py:377-404` — `/config` GET/PUT. GET auto-seeds row id=1 if missing (line 381). PUT applies `model_dump(exclude_unset=True)` field-by-field. **No joins, no list-of-items support.** The single-row design is intentional.

### Backend: migration system (custom, NOT Alembic)
- `backend/app/database.py:30` — table creation: `SQLModel.metadata.create_all(engine)` is called from `lifespan` at `main.py:173`. Adding a new SQLModel `table=True` class **automatically creates the table on next startup** — no manual migration needed for brand-new tables.
- `backend/app/main.py:93-127` — `run_migration()` is **for ALTER TABLE on existing tables** (non-destructive ADD COLUMN). It uses `has_column()` helper (lines 73-90) to check column existence before adding, with both PostgreSQL (`information_schema.columns`) and SQLite (`PRAGMA table_info`) branches. **It is not the right tool for creating a new table** — `create_all()` handles that.
- `backend/app/main.py:170-181` — `lifespan` runs `[_validate_jwt_secret_key, create_db_and_tables, run_migration, seed_default_config, seed_default_schedule, seed_admin_user]` in order. A new `seed_default_gallery` would plug in here.

### Backend: public + admin pattern
- `backend/app/main.py:650-769` — `/public/clients` and `/public/appointments` (the public-booking endpoints) show the **canonical pattern**: unauthenticated route, rate-limit decorator (`@limiter.limit`), explicit honeypot check, no `Depends(get_current_user)`. Admin endpoints take `current_user: Usuario = Depends(get_current_user)`.

### Frontend: admin
- `frontend/src/components/admin/BusinessConfigSection.tsx` (71 LOC) — **flat form**, 7 labeled text inputs, single Save button. NOT a CRUD-with-list. State lives in `Admin.tsx` (`configForm`, `handleUpdateConfig`).
- `frontend/src/components/admin/ServicesSection.tsx` (178 LOC) — **closest pattern to a future GallerySection**: split into "Crear" form (left) + DataTable (right, with sortable/filterable columns) + edit card overlay. List of items with Edit/Activate/Deactivate/Delete actions.
- Admin page wires them in via `<details>` collapsibles (`Admin.tsx:478-598`).

### Frontend: hooks & API
- `frontend/src/hooks/useConfig.ts` (19 LOC) — `useQuery` for read, `useMutation` for update with `invalidateQueries(['config'])` on success. No optimistic updates.
- `frontend/src/hooks/useServices.ts` (40 LOC) — full CRUD: `useServices`, `useCreateService`, `useUpdateService`, `useDeleteService`. All invalidate `['services']` on success.
- `frontend/src/api.ts:202-210` — `getConfig`/`updateConfig` are plain async functions, no wrapper class. Same flat pattern repeated for services, clients, schedule (lines 146-273).

### Frontend: navbar
- `frontend/src/App.tsx:111-152` — navbar is **inline in `App.tsx`**, ~50 LOC of brand + desktop links + hamburger + drawer wiring. Brand uses `<GiAngelWings />` icon at line 114. No `Navbar.tsx` component exists yet.

### Brand assets
- `static/assets/Gold Vintage Victorian Romantic Frame Wedding Monogram Logo.png` — **3.5 MB** PNG. Lives in repo root, not served by FastAPI (no `StaticFiles` mount in `main.py`).
- `frontend/index.html` — **no favicon link, no static assets**. No `frontend/public/` directory exists.

### Tests
- `backend/tests/conftest.py:28-32` — single autouse fixture: `_reset_rate_limiter` (clears slowapi state after every test). All test files in this dir inherit it.
- `backend/tests/test_endpoints.py:62` — auth fixture pattern (`admin_token` from a TestClient login flow). Test files: `test_api.py`, `test_auth.py`, `test_deps.py`, `test_endpoints.py`, `test_jwt_secret_startup.py`, `test_usuario.py`.
- **No `/gallery` tests exist** — they need to be created from scratch following the `/services` test pattern.

### REQUIREMENTS.md conflict (CRITICAL)
- `REQUIREMENTS.md:41` — explicitly says **"Sección de Trabajos Realizados (Carrusel): Slider de imágenes interactivo y responsive"**. The user has now confirmed a **grid (no carousel)** with a11y justification. This change **inverts an existing requirement** — the proposal phase MUST flag this for explicit user confirmation and REQUIREMENTS.md must be updated to "Grid" (not delete the section).

### ARCHITECTURE.md
- `ARCHITECTURE.md:27` — describes `Configuración` only. **No mention of `Galería` or `Trabajos Realizados`** as a domain entity. The new `GalleryItem` aggregate needs to be added to the "Modelo de dominio" section.

---

## 2. Affected Areas (exhaustive)

### Backend
- `backend/app/models.py` — add `GalleryItem(SQLModel, table=True)` (new class).
- `backend/app/schemas.py` — add `GalleryItemRead`, `GalleryItemCreate`, `GalleryItemUpdate`, and a new `GalleryRead` for the bundle (if approach C wins). All `ConfigDict(from_attributes=True)`, validators for `image_url` (URL), `link_url` (optional URL), `alt_text` (non-empty), `orden` (1..6), `activo` (bool).
- `backend/app/main.py:21-22` — imports: add `GalleryItem` and new schemas.
- `backend/app/main.py:42-46` — add `seed_default_gallery(session)` that creates 6 inactive slots with `orden=1..6` on first run (matches the `seed_default_config` pattern).
- `backend/app/main.py:174` — register `seed_default_gallery` in the lifespan list.
- `backend/app/main.py` — new endpoints: `GET /gallery` (public, returns ordered list of 6), and the admin CRUD trio `POST /gallery` / `PATCH /gallery/{id}` / `DELETE /gallery/{id}` (with `Depends(get_current_user)`).
- `backend/tests/test_endpoints.py` (or new `test_gallery.py`) — tests for: public GET returns 6 items ordered by `orden`, POST requires auth, PATCH requires auth, DELETE requires auth, image_url validator rejects garbage, alt_text is mandatory, orden must be 1..6, deactivation vs deletion semantics.

### Frontend — public (Home)
- `frontend/src/pages/Home.tsx` — extend from 5 sections to 10 (replace lines 110-188 region). Reorder so gallery is between Servicios and Sobre mí. Add `useGallery()` hook call, pass to a new `<GallerySection>` component.
- `frontend/src/components/public/GallerySection.tsx` — **new file** (~80 LOC). Responsive CSS grid (3x2 desktop, 2x3 tablet, 1-2 per row mobile), lazy-load images, anchor wrapper when `link_url` set, skeleton + empty + error states.
- `frontend/src/components/public/AboutMeSection.tsx` — **new file** (~30 LOC). Static first-person copy.
- `frontend/src/components/public/HowToBookSection.tsx` — **new file** (~50 LOC). Numbered list + final CTA button → `/reservar`.
- `frontend/src/components/public/TestimonialsSection.tsx` — **new file** (~50 LOC). 3 hardcoded testimonial cards.
- `frontend/src/components/public/FaqSection.tsx` — **new file** (~70 LOC). `<details>`/`<summary>` accordion (native, accessible by default).

### Frontend — admin
- `frontend/src/components/admin/GallerySection.tsx` (or `GalleryConfigSection.tsx`) — **new file** (~200 LOC). 6 slot editors, each with: image URL input + alt text input + optional link URL input + active toggle + reorder arrows.
- `frontend/src/hooks/useGallery.ts` — **new file** (~50 LOC). `useGallery` (public), `useAdminGallery`, `useCreateGalleryItem`, `useUpdateGalleryItem`, `useDeleteGalleryItem`.
- `frontend/src/api.ts` — add `getGallery`, `createGalleryItem`, `updateGalleryItem`, `deleteGalleryItem`, types `GalleryItem`/`GalleryItemCreate`/`GalleryItemUpdate`.
- `frontend/src/pages/Admin.tsx:60-91` — add `'galeria'` to `COLLAPSIBLE_IDS` (line 60), wire up `collapsiblesState`, render new `<details>` block (~30 LOC added).
- `frontend/vite.config.ts` — add `'/gallery': 'http://localhost:8000'` to the dev proxy (8 lines already, 1 more).

### Frontend — brand shell
- `frontend/src/components/layout/Navbar.tsx` — **new file** (~150 LOC). Extract navbar + drawer wiring from `App.tsx:111-216`. Replace `<GiAngelWings />` with `<img src="/logo.png" alt={businessName} width={36} height={36} className="navbar-brand-logo" />`.
- `frontend/src/App.tsx` — slim to ~30 LOC. Remove the inline navbar block (lines 111-216), keep the footer and FAB. Import the new `<Navbar />`.
- `frontend/public/logo.png` — **new optimized logo** (target <30 KB). Source: `static/assets/Gold Vintage Victorian Romantic Frame Wedding Monogram Logo.png` (3.5 MB → optimize with `oxipng` or `sharp`).
- `frontend/public/favicon.ico` (+ `favicon-32x32.png`, `apple-touch-icon.png`) — **new multi-resolution favicons**, target total <120 KB.
- `frontend/index.html:5-9` — add `<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />` + `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` in `<head>`.

### Frontend — styles
- `frontend/src/index.css` — append to `@layer components` block (line 181-280). Add `.gallery-grid`, `.gallery-item`, `.gallery-item img`, `.gallery-empty`, `.faq-item`, `.faq-item summary`, `.testimonial-card`, `.about-section`. Reuse existing `.section`, `.section-header`, `.overline` classes for consistency.

### Docs
- `REQUIREMENTS.md:41` — update "Sección de Trabajos Realizados (Carrusel)" to "Sección de Trabajos Realizados (Grid)". Add the 4 new sections: Sobre mí, Cómo reservar, Testimonios, FAQ. Keep ✅ marker concept (none of the new sections are implemented yet).
- `ARCHITECTURE.md:20-27` — add a new bullet under "Modelo de dominio": `Galería (Trabajos Realizados): conjunto de hasta 6 slots administrables con URL externa, alt text, link opcional, orden y estado activo, renderizados como grid público.`
- `DOCUMENTATION.md` — record the change after apply.

---

## 3. Approaches (gallery data model)

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **A. Standalone `GalleryItem` table + `GET /gallery` endpoint** | Clean aggregate; `image_url`/`alt_text` as proper columns (not JSON); per-row queries trivial; type-safe Pydantic; matches `ClienteTelefono` (SQLModel `table=True` with FK) pattern; trivial to extend (more slots, captions) | Two network calls for the public page (config + gallery); Home page adds a 3rd `useQuery`; `useConfig` does not invalidate gallery on save (admin must remember) | Low |
| **B. Embed in `Configuracion` as JSON column or 6 nullable FK columns** | Single `/config` round-trip; consistent with current "all config in one place" feel | JSON: Pydantic validation lost at DB boundary, awkward migration story. FKs: 6 columns is a smell; changing slot count = migration; 6-row query is awkward | Medium (JSON path) / High (FK path) |
| **C. Hybrid: `GalleryItem` table + join into `GET /config` response** | One round-trip for public; gallery data lives in its own aggregate; type-safe; easy admin edit; `get_config` becomes a richer "site config bundle" | Couples two unrelated concerns in one endpoint; changes the `ConfiguracionRead` shape (breaking) — every frontend consumer of `getConfig` must be updated; invalidate semantic muddled | Medium |

**Approach A (standalone)** aligns best with the existing patterns:
- `ClienteTelefono(SQLModel, table=True)` is already the canonical "child of another entity" pattern (`models.py:34-40`).
- Public endpoints with their own GET are already the rule (`/services`, `/schedule/weekly`, `/public/appointments`).
- The existing `/config` endpoint is intentionally **flat and singular** (single-row, scalar fields). Bolting a list onto it would violate that.

**Tradeoff A vs C**: A costs one extra `useQuery` in `Home.tsx` and a 3rd invalidate-key for admin saves. C saves a round-trip but breaks `ConfiguracionRead`. The round-trip is cheap (local LAN / Render same-region) and `TanStack Query` already de-duplicates and caches. **A wins on consistency, type safety, and minimal blast radius.**

---

## 4. Approaches (admin UI)

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **A. Inline expansion in `BusinessConfigSection.tsx`** | One collapsible ("Configuración del negocio") = one place for everything; 6 slot editors feel "config-y" | `BusinessConfigSection` is currently 71 LOC of flat inputs. Adding 6 slot editors + reorder + image URL previews = ~200 LOC → 270+ LOC, well over the 400-LOC review budget for the whole change. Loses the "create form + DataTable" pattern of services | Medium |
| **B. New dedicated `GallerySection.tsx` component + new collapsible "Galería de Trabajos" in `Admin.tsx`** | Mirrors `ServicesSection` (CRUD-with-list); isolates gallery concerns; easy to test in isolation; doesn't bloat the config form; admin naturally discovers it as its own feature; lower per-file LOC | One more collapsible; admin page grows by ~30 LOC; separate "Guardar" button per slot OR per-row save (UX decision) | Low–Medium |

**B wins.** `ServicesSection.tsx` is the closest pattern (CRUD + DataTable) and the gallery is a peer concern, not a sub-field of business config. Splitting it out keeps the `BusinessConfigSection` from ballooning past 250 LOC and respects the 400-LOC review budget.

---

## 5. Approaches (public rendering)

| Approach | Pros | Cons | Complexity |
|----------|------|------|------------|
| **A. CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`)** | Matches the existing `.service-grid` pattern (`index.css:227`); responsive by default; can be tuned at the gallery section level for 3/2/1 column count via explicit media queries | Slightly less control over exact column count at each breakpoint vs hand-tuned `grid-template-columns: repeat(3, 1fr)` | Low |
| **B. Flexbox with `flex-wrap`** | More familiar to junior devs | Hard to enforce equal-width cells; needs explicit `width: calc(33.33% - gap)` math; doesn't give row alignment for free | Low |
| **C. Hand-tuned media queries (`grid-template-columns: repeat(3, 1fr)` desktop, `repeat(2, 1fr)` tablet, `1fr` mobile)** | Exact control over column count per breakpoint (3/2/1) | More code; needs to know the breakpoints the project already uses (the project has `@media (max-width: 1023px)` and `@media (max-width: 767px)` per `index.css:235, 258`) | Medium |

**A wins for the same reasons `.service-grid` was chosen.** Use `repeat(auto-fill, minmax(280px, 1fr))` and let CSS handle responsive — the explicit 3/2/1 target can be hit by adjusting `minmax(280px, 1fr)` if needed. No new breakpoints required.

---

## 6. Migration strategy

**Adding a new SQLModel `table=True` class needs ZERO migration work.** Evidence:
- `backend/app/database.py:30` — `SQLModel.metadata.create_all(engine)` runs on every startup.
- `backend/app/main.py:173` — `create_db_and_tables()` is called from `lifespan` **before** `run_migration()`.
- `SQLModel.metadata.create_all` is non-destructive: it `CREATE TABLE IF NOT EXISTS`-style, so re-running it on an existing DB is safe.
- The existing `run_migration()` (`main.py:93-127`) is **only for ALTER TABLE on existing tables** (the `activo` column on `cliente` is the canonical example).

**Action**: just define `class GalleryItem(SQLModel, table=True)` in `models.py`. It will be created on next startup. No `has_column()` call needed. Add a `seed_default_gallery(session)` in `main.py:42-46` area and register it in the lifespan list (`main.py:174`) to ensure 6 inactive rows exist (so the admin UI has slot 1..6 to edit from the start). The seed must be **idempotent** (skip if rows already exist) — same pattern as `seed_default_schedule` (`main.py:49-70`).

**Risk**: if `create_all()` is ever removed (e.g., the project moves to Alembic), this assumption breaks. Worth a one-line comment in `database.py` documenting the contract.

---

## 7. Recommendation

1. **Data model: Approach A** — standalone `GalleryItem` table with its own endpoints. Matches the `ClienteTelefono` aggregate pattern. Keeps `/config` flat and singular. One extra `useQuery` in `Home.tsx` is a non-issue.
2. **Admin UI: Approach B** — new `GallerySection.tsx` in `frontend/src/components/admin/`, wired in as a peer `<details>` collapsible in `Admin.tsx`. Mirrors the `ServicesSection` CRUD pattern; keeps `BusinessConfigSection` from ballooning.
3. **Public rendering: Approach A** — CSS Grid with `repeat(auto-fill, minmax(280px, 1fr))`, reusing the existing `.section`/`.section-header`/`.overline` classes. Lazy-load via `loading="lazy"` + `decoding="async"`, explicit `width`/`height` to prevent CLS.
4. **Public sections without backend (Sobre mí, Cómo reservar, Testimonios, FAQ)** — frontend-only, content inlined in the new section components (copy drafted in the apply phase, user-reviewed). No new endpoints, no schemas.
5. **Brand shell** — extract `Navbar.tsx`, replace icon with optimized `public/logo.png`, add multi-resolution favicons in `public/`, update `index.html` head.

**Estimated LOC (apply phase)**:
- Backend: ~150 LOC (1 model + 3 schemas + 4 endpoints + seed + tests)
- Frontend (public): ~350 LOC (5 new section components + Home.tsx extension)
- Frontend (admin): ~280 LOC (GallerySection + hook + api helpers + Admin.tsx wiring)
- Frontend (brand): ~180 LOC (Navbar extraction + 3 favicon links + index.html)
- Tests: ~120 LOC backend pytest
- CSS: ~120 LOC in `index.css` `@layer components`
- Docs: ~30 LOC (`REQUIREMENTS.md` update, `ARCHITECTURE.md` addition)
- **Total: ~1230 LOC**, **~3× the 400-LOC review budget** (see risks).

---

## 8. Risks

1. **400-LOC review budget overrun** — `openspec/config.yaml:81` sets `review.budget_lines: 400`. This change is ~1230 LOC, **3× over budget**. Mitigations:
   - **Recommend chained PRs**: PR 1 = backend (gallery table, endpoints, tests); PR 2 = frontend public (5 new sections, Home.tsx rewire); PR 3 = frontend admin (GallerySection + hook + Admin wiring); PR 4 = brand shell (Navbar.tsx, favicons, logo).
   - Alternative: single PR with a "this is a known-budget-overrun change" gate acknowledged by the user.
2. **REQUIREMENTS.md conflict** — line 41 says "Carrusel"; new scope says "Grid" (no carousel, a11y-justified). Must be flagged to the user in the proposal; REQUIREMENTS.md needs an explicit update.
3. **Image weight / CLS** — admin pastes external URLs; we have no control over file size or aspect ratio. Without enforced `width`/`height` and `loading="lazy"`, the page will jump and burn bandwidth. Mitigations: explicit `width`/`height` in the markup, `loading="lazy"`, `decoding="async"`, `object-fit: cover`, doc-block guidance in the admin UI telling the admin to use 4:3 / 1:1 aspect ratios.
4. **External image reliability** — admin pastes an Instagram CDN URL, Instagram rotates it, image breaks. Mitigations: graceful fallback in `<img onError>` (show alt text or a placeholder), doc-block in admin UI warning about hotlink fragility, consider a "Test all 6 URLs" button.
5. **Admin UX on 6 slots** — naive UI is 6 identical stacked forms (~600 LOC). Risk of feeling overwhelming. Mitigations: collapsible per-slot cards, "Save all" button, show image preview thumbnail inline so the admin can verify each URL.
6. **Brand-voice on orchestrator-drafted copy** — Sobre mí, Testimonios, FAQ copy will be drafted in the apply phase with first-person warm tone. The user must review and approve before merge. Risk: copy sounds AI-generic. Mitigation: 2-3 short paragraphs max (80-150 words for Sobre mí), use the actual brand voice from the existing `business_name` and existing service descriptions.
7. **Logo optimization** — 3.5 MB PNG → must hit <30 KB after optimization without visible quality loss. The Victorian frame detail is delicate; naive compression destroys the filigree. Mitigations: use `oxipng -o max` for lossless first, then `sharp` for lossy fallback to a target file size. Verify visually before commit.
8. **Migration safety** — `SQLModel.metadata.create_all` is non-destructive, but if the project ever moves to Alembic, this assumption breaks. Add a one-line comment in `database.py` documenting the "new tables are auto-created, only ALTER needs the manual migration" contract.
9. **Public gallery fetch failure must not blank the page** — `useGallery` failing on the public Home should NOT prevent the rest of the page from rendering. Mitigations: wrap the gallery section in its own `useGallery` + try/catch + `<GallerySection error={...} />` that renders the rest of the page (other 5 sections) and shows a non-blocking error chip on the gallery placeholder.

---

## 9. Open questions for the propose phase

1. **Slot count fixed at 6 or dynamic?** — fixed is simpler (1-6 unique, indexed by `orden`, no gaps). Dynamic requires a richer admin (add/remove rows) and changes the migration story.
2. **Link behavior on click** — open in same tab (probably wrong for external links), new tab (`target="_blank" rel="noopener noreferrer"`), or lightbox/zoom? Lightbox adds ~80 LOC and is the most common gallery UX, but conflicts with the user's "no carousel" directive (a lightbox is technically a modal, not a carousel — verify with user).
3. **Where to wire the admin sub-section** — Option A: new `<details>` "Galería de Trabajos" between "Servicios" and "Configuración del negocio". Option B: tab inside `BusinessConfigSection` (requires tabbed UI, more code). Option C: sub-section rendered inside the existing "Configuración del negocio" details (keeps single admin entry point, but bloats that file).
4. **alt_text enforcement** — reject empty string in the Pydantic schema, or show a warning but allow save? Strict = better for a11y, but admins will fight it.
5. **Max image dimensions** — recommend a max display size in the admin UI (e.g., "use 1200×800 or smaller; the grid displays them at ~360×240")? Or just trust the admin to optimize?
6. **Public gallery fetch error behavior** — non-blocking error chip (recommended) vs hiding the section entirely?
7. **Image preview** — show a thumbnail preview as the admin types the URL? Worth the extra debounced fetch code?
8. **Active toggle UX** — toggle per row, or batch "show all / hide all" buttons? Per-row matches the services pattern; batch is a quality-of-life extra.
9. **Reorder mechanism** — up/down arrows per row, or drag-and-drop? Up/down is keyboard-accessible and ~20 LOC. Drag-and-drop needs a library (dnd-kit, ~30 KB) and a single-pointer alternative anyway (WCAG 2.5.7).
10. **Favicon total weight budget** — accept up to 150 KB total, or stricter (60 KB) for Lighthouse?
11. **Logo placement in navbar** — replace just the icon, or also the text? The brand `.navbar-brand` is `[icon] [text]`. Replacing icon only is minimal; replacing both is a bigger visual swing.
12. **Bundle all 5 frontend-only sections into one PR or split** — Sobre mí, Cómo reservar, Testimonios, FAQ are each <100 LOC. Bundle in PR 2 or split further into 4 micro-PRs?
13. **Should we add a `slot` field (1..6, unique) to the GalleryItem model, or reuse `id`?** — `id` is auto-increment and doesn't reflect slot position. `slot` makes admin UX cleaner ("edit slot 3"). Recommend `orden` (1..6, unique) to allow future gap-handling.
14. **Should `/gallery` be public (no auth) or admin-only?** — user confirmed public GET. Confirm in the proposal.

---

## 10. Ready for proposal

**Yes — with conditions.**

- The user MUST confirm the 400-LOC budget decision: **chained PRs (recommended) vs single big PR with budget exception**.
- The user MUST confirm the REQUIREMENTS.md update path: replace "Carrusel" with "Grid" in-place, or add a new sub-section (2.A.4) and mark the original as superseded.
- The user MUST confirm the link-on-click behavior (new tab with `rel="noopener noreferrer"` is the safe default, but lightbox is the common UX for image galleries).
- The user MUST confirm the brand asset decisions: which favicon resolutions, max total KB, where the optimized logo lives (`public/` vs `src/assets/`).

Open questions 1-14 above are blockers for the `propose` phase. Once answered, the proposal can be drafted in 1-2 hours and will be ~250-300 LOC of its own (in `proposal.md`).
