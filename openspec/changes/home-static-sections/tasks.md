# Tasks: `home-static-sections`

**Change**: `home-static-sections` | **Phase**: tasks | **Strict TDD**: ACTIVE for backend (PR 1)
**Run**: `python -m pytest` (backend) | `npx tsc --noEmit` (frontend)
**Source artifacts**: `proposal.md`, `specs/{home-gallery,home-static-content,online-booking}/spec.md`, `design.md` (1,134 lines)
**Branch**: `feat/home-static-sections` (at `ceb56e4`, tracking `origin/main` `615cd76` — includes PR #54 brand-shell hotfix)

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | **~1,403 source LOC** (excludes 4 binary assets in `frontend/public/` inherited from PR #54) |
| Chained PRs recommended | **Yes** (4 chained PRs to `main`, in order) |
| Chain strategy | `stacked-to-main` (LOCKED — user decision 2026-07-03, Engram #325) |
| 400-line budget risk | **Medium** (PR 1 = 390 within, PR 2 = **680 over — size-exception pre-approved D3**, PR 3 = 285 within, PR 4 = 48 within) |
| Decision needed before apply | **No** (size-exception already approved, chain strategy locked, logo size locked) |
| Delivery strategy | `auto-forecast` → orchestrator must surface forecast to user before launching apply |

### Per-PR LOC breakdown

| PR | Source LOC | Binary | Files | Budget | Status |
|---|---|---|---|---|---|
| PR 1 — Backend: `GalleryItem` + endpoints + tests | **~390** | 0 | 6 | within (97.5%) | OK |
| PR 2 — Public FE: 5 new sections + Home rewire + docs | **~680** | 0 | 14 | **OVER (size-exception pre-approved)** | OK with exception |
| PR 3 — Admin FE: `GallerySection` + hook + Admin wiring | **~285** | 0 | 6 | within (71%) | OK |
| PR 4 — Brand shell: Navbar extract + logo bump | **~48** | 0 (inherited) | 3 | within (12%) | OK |
| **Total** | **~1,403** | 0 | 29 | 1 over-budget PR | LOCKED |

### Forecast risk read

- **PR 2 overshoots 400-line review budget by ~70%** — D3 in design locks `size:exception` (user pre-approved 2026-07-03).
- **7 work-unit commits in PR 2** split the over-budget PR into reviewable chunks. Two of those work-units exceed the 150-LOC sub-budget; **both are split further below** to honor the work-unit-commits skill's hard rule.
- All 4 PRs have disjoint file sets → no integration risk that a tracker would absorb → `stacked-to-main` is correct (D16, D17).

---

## Branch strategy

- **Tracker**: `feat/home-static-sections` (already exists at `ceb56e4`).
- **Base**: `origin/main` at `615cd76` (includes PR #54 brand-shell hotfix — logo.png, favicon.ico, favicon-32x32.png, apple-touch-icon.png all in main).
- **Chain strategy**: `stacked-to-main` (LOCKED — each PR targets `main` directly, no feature-branch-chain tracker PR).
- **Worktrees**: each PR branches from the latest `main` after the previous PR merges. PR 1 and PR 4 can branch in parallel from the same `main` snapshot — disjoint file sets, no race.

```
PR 1 ─► main       (backend, no deps)
PR 4 ─► main       (brand shell, no deps, parallel with PR 1)
PR 2 ─► main       (public FE, depends on PR 1 endpoint)
PR 3 ─► main       (admin FE, depends on PR 1 endpoints; parallel with PR 2)
```

---

## Work-unit commit plan (≤150 LOC each)

> **Two design-seed commits exceed 150 LOC and are split further**: PR 2 commit #2 (GallerySection + Lightbox + CSS, 200 LOC) and PR 3 commit #2 (GallerySection admin, 200 LOC). The split is documented in the relevant PR sections below and does not change the 4-PR breakdown.

### PR 1 — Backend (6 work-units, ~390 LOC, ~6 days)

Target branch: `feat/home-static-sections-pr1-backend` (branched from `main@615cd76`).

- [ ] **W1.1** `chore(sdd): add GalleryItem SQLModel + ARCHITECTURE.md entry` (~30 LOC)
  - Append `GalleryItem` class to `backend/app/models.py` (15 LOC, mirrors `ClienteTelefono` pattern at `models.py:34-40`).
  - Add `Galería` line to `ARCHITECTURE.md:27` (5 LOC).
  - One-line comment to `backend/app/database.py:30` documenting the `create_all` contract (~3 LOC, R7 mitigation).
  - No test in this commit — model is exercised by endpoint tests in W1.2-W1.6.
  - **AC**: `python -c "from app.models import GalleryItem; print(GalleryItem.__tablename__)"` prints `galleryitem`; `git diff --stat` shows ≤ 30 LOC.

- [ ] **W1.2** `feat(sdd): add gallery Pydantic schemas (RED → GREEN)` (~80 LOC)
  - **RED**: append `TestGallerySchemas` to `backend/tests/test_gallery.py` with 4 cases: `test_create_rejects_orden_out_of_range`, `test_create_rejects_invalid_url`, `test_create_rejects_empty_alt_text`, `test_update_excludes_orden_field`. Run `pytest backend/tests/test_gallery.py::TestGallerySchemas -v` → see `ImportError` or `AttributeError` (fail expected).
  - **GREEN**: append `GalleryItemRead`, `GalleryItemCreate`, `GalleryItemUpdate` to `backend/app/schemas.py` (55 LOC). `image_url`/`link_url` use `HttpUrl` on Create/Update; `GalleryItemRead.image_url: str` (str column, not HttpUrl — avoids Pydantic v2 trailing-slash quirk, R12). `orden` is `ge=1, le=6`.
  - Re-run pytest → green.
  - **AC**: 4 schema tests pass; `python -c "from app.schemas import GalleryItemCreate, GalleryItemUpdate, GalleryItemRead"` succeeds; `git diff --stat` shows ~80 LOC.

- [ ] **W1.3** `feat(sdd): GET /gallery public endpoint + tests` (~90 LOC)
  - **RED**: append `TestGalleryPublicGet` to `backend/tests/test_gallery.py` (4 cases: `test_get_returns_empty_list_when_table_empty`, `test_get_returns_six_items_ordered_by_orden`, `test_get_does_not_require_auth`, `test_get_includes_inactive_items`). Run → 404 expected (endpoint doesn't exist).
  - **GREEN**: append `GET /gallery` to `backend/app/main.py` (near `services` block at `main.py:962`). Returns `list[GalleryItemRead]` ordered by `orden` ASC. No auth dependency. `seed_default_gallery` import + `_check_orden_conflict` helper.
  - Re-run pytest → green.
  - **AC**: 4 GET tests pass; `curl http://localhost:8000/gallery` returns 6 items after `seed_default_gallery` runs; `git diff --stat` shows ~90 LOC.

- [ ] **W1.4** `feat(sdd): POST /gallery admin endpoint + tests` (~70 LOC)
  - **RED**: append `TestGalleryAdminCreate` (4 cases: `test_create_returns_201_with_payload`, `test_create_without_auth_returns_401`, `test_create_with_duplicate_active_orden_returns_409`, `test_create_with_inactive_duplicate_orden_succeeds` — R13 spec scenario, app-level check). Run → 404 expected.
  - **GREEN**: append `POST /gallery` to `backend/app/main.py`. Depends on `get_current_user`. Uses `_check_orden_conflict(orden, exclude_id=None)` to enforce partial uniqueness (R13 mitigation — portable across SQLite + Postgres). 409 with `detail: "orden_conflict: ya existe un slot activo con orden=N"` on conflict.
  - Re-run pytest → green.
  - **AC**: 4 POST tests pass; unauthorized request returns 401; `git diff --stat` shows ~70 LOC.

- [ ] **W1.5** `feat(sdd): PATCH + DELETE /gallery admin endpoints + tests` (~80 LOC)
  - **RED**: append `TestGalleryAdminPatch` (3 cases: `test_patch_updates_only_provided_fields`, `test_patch_with_missing_id_returns_404`, `test_patch_without_auth_returns_401`) + `TestGalleryAdminDelete` (3 cases: `test_delete_returns_204`, `test_delete_with_missing_id_returns_404`, `test_deleted_slot_removed_from_get`). Run → 404 expected.
  - **GREEN**: append `PATCH /gallery/{id}` (uses `model_dump(exclude_unset=True)` — matches `PATCH /services/{id}` pattern at `main.py:977`) and `DELETE /gallery/{id}` (204, no body — matches `DELETE /services/{id}` shape). Both depend on `get_current_user`.
  - Re-run pytest → green.
  - **AC**: 6 PATCH + DELETE tests pass; total 18 tests in `test_gallery.py`; `git diff --stat` shows ~80 LOC.

- [ ] **W1.6** `chore(sdd): seed_default_gallery in lifespan` (~40 LOC)
  - Append `seed_default_gallery(session)` to `backend/app/main.py` (12 LOC, mirrors `seed_default_schedule` at `main.py:49-70`). Idempotent: `existing = session.exec(select(GalleryItem)).first(); if existing: return`. Otherwise inserts 6 rows with `orden=1..6`, `activo=False`, all other fields at model defaults.
  - Register in lifespan list at `main.py:174` (+1 LOC).
  - **RED**: append `TestGallerySeed` (3 cases: `test_seed_creates_six_inactive_slots`, `test_seed_is_idempotent_on_populated_db`, `test_seed_does_not_overwrite_existing_data`). Run → see 6 items missing or wrong count.
  - **GREEN**: ship the seed function. Re-run pytest → green.
  - **AC**: 3 seed tests pass; `test_gallery.py` total is **21 tests** (16 baseline + 5 added in W1.2-W1.6 above the design's 16-18 floor — R13 risk-driven additions); `git diff --stat` shows ~40 LOC.

### PR 2 — Public frontend (8 work-units, ~680 LOC)

Target branch: `feat/home-static-sections-pr2-public-fe` (branched from `main` after PR 1 merges).

> **Work-unit commit W2.2 split**: the design lists `feat(sdd): GallerySection + Lightbox + index.css grid` as one commit at ~200 LOC. Per the 150-LOC work-unit budget, split into W2.2a (component + grid CSS) and W2.2b (Lightbox + lightbox CSS). Total LOC unchanged.

- [ ] **W2.1** `chore(sdd): add useGallery hook + api.ts gallery helpers` (~90 LOC)
  - Append `GalleryItemRead` type + `getGallery()` to `frontend/src/api.ts` (~15 LOC).
  - Create `frontend/src/hooks/useGallery.ts` (~50 LOC). Exports `useGallery()` with `queryKey: ['gallery']`, `staleTime: 0`, `gcTime: 5*60*1000`, `refetchOnWindowFocus: true`. Re-export from `frontend/src/hooks/index.ts` (+1 LOC).
  - Add `'/gallery': 'http://localhost:8000'` to dev proxy in `frontend/vite.config.ts` (+1 LOC).
  - **AC**: `npx tsc --noEmit` clean (hook compiles against the `GalleryItemRead` shape); `git diff --stat` shows ~90 LOC.

- [ ] **W2.2a** `feat(sdd): GallerySection component + index.css grid styles` (~130 LOC)
  - Create `frontend/src/components/public/GallerySection.tsx` (95 LOC). Owns: CSS Grid wrapper, click handling (link vs lightbox), `onError` fallback to `gallery-item-fallback` block (REQ-HGAL-060), empty state ("Galería sin imágenes activas por el momento"), `aria-busy` while loading.
  - Append to `frontend/src/index.css` `@layer components`: `.gallery-grid`, `.gallery-item`, `.gallery-item-fallback`, `.gallery-empty` (~35 LOC).
  - Imports `useGallery`, renders the 6-slot grid with `loading="lazy"`, `decoding="async"`, explicit `width={384}` `height={288}` (4:3, REQ-HGAL-030).
  - **AC**: with the dev server running, `GET /gallery` returns 6 items, the grid renders; `npx tsc --noEmit` clean; `git diff --stat` shows ~130 LOC.

- [ ] **W2.2b** `feat(sdd): Lightbox component + index.css lightbox styles` (~70 LOC)
  - Create `frontend/src/components/public/Lightbox.tsx` (50 LOC). Mirrors focus-trap pattern at `App.tsx:52-86`. `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to hidden `<h2>` with `alt_text`. Focus moves to close button on open, returns to trigger on close. `document.body.style.overflow = 'hidden'` while open. Escape closes. 44×44 close button (WCAG 2.5.8).
  - Append to `frontend/src/index.css` `@layer components`: `.lightbox-backdrop`, `.lightbox-content`, `.lightbox-image`, `.lightbox-close` + 4-LOC reduced-motion belt-and-suspenders block for the chevron (~20 LOC).
  - Imports + integrates Lightbox into GallerySection's `link_url === null` branch.
  - **AC**: clicking an image without `link_url` opens the lightbox; Escape closes; Tab cycles inside; `npx tsc --noEmit` clean; `git diff --stat` shows ~70 LOC.

- [ ] **W2.3** `feat(sdd): extend Home.tsx from 5 to 10 sections` (~60 LOC)
  - Modify `frontend/src/pages/Home.tsx` (191 → ~251 LOC). Add 5 imports, add 5 new section components between `<Servicios />` (line 58-106) and `<Conectemos />` (line 110-159) in the locked order: `<Galeria />` → `<SobreMi />` → `<ComoReservar />` → `<Testimonios />` → `<Faq />`.
  - Sections render with placeholder copy (`<p>Placeholder</p>` in each — the copy commits are W2.4-W2.6).
  - **AC**: `npx tsc --noEmit` clean; DOM order matches locked: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación; `git diff --stat` shows ~60 LOC.

- [ ] **W2.4** `feat(sdd): AboutMeSection copy + wiring` (~35 LOC)
  - Create `frontend/src/components/public/AboutMeSection.tsx` (35 LOC). 2-3 paragraphs in `<p>` with `max-width: 720px`. Marked with `// TODO(sdd): user voice review required` at the top of the const array.
  - **Process gate**: orchestrator-drafted copy in first-person warm tone, mirrors Hero voice ("En {business_name} cada detalle importa"). 80-150 words. The user MUST approve before verify passes (REQ-HSSC-060).
  - **AC**: `npx tsc --noEmit` clean; file contains the `TODO(sdd):` comment; `git diff --stat` shows ~35 LOC.

- [ ] **W2.5** `feat(sdd): HowToBookSection steps + wiring` (~55 LOC)
  - Create `frontend/src/components/public/HowToBookSection.tsx` (55 LOC). 4 `<li>` numbered steps mirroring `/reservar` flow (REQ-HSSC-020): (1) elegir servicios, (2) completar datos + seleccionar fecha/hora, (3) revisar resumen y confirmar, (4) pagar seña por transferencia y enviar comprobante. Last step has `<button>Reservar Turno</button>` → `/reservar`.
  - No `TODO` comment — copy is procedural and stable.
  - **AC**: button is `onClick` + Enter/Space activable; navigates to `/reservar`; `npx tsc --noEmit` clean; `git diff --stat` shows ~55 LOC.

- [ ] **W2.6** `feat(sdd): TestimonialsSection + FaqSection copy + wiring` (~140 LOC)
  - Create `frontend/src/components/public/TestimonialsSection.tsx` (60 LOC). 3 cards, each with a quote and a generic name ("María L.", "Sofía G.", "Laura P."). Viewports ≥ 768px: 3 columns; < 768px: stacked. Marked with `// TODO(sdd): user voice review required` at the top of the const array (REQ-HSSC-030 — the studio has no real testimonials yet, copy is illustrative; the "Testimonio" badge is in the card itself, D13).
  - Create `frontend/src/components/public/FaqSection.tsx` (80 LOC). Multi-open accordion (D1, REQ-HSSC-040). `useState<Set<number>>(new Set())`. 4-5 Q&A pairs. `<button aria-expanded aria-controls>` pattern. Marked with `// TODO(sdd): user voice review required` at the top of the const array.
  - **Process gate**: orchestrator-drafted copy in both components; user MUST approve before verify passes (REQ-HSSC-060).
  - **AC**: FAQ multi-open (clicking one does NOT close the others); cards are responsive (3-col desktop, 1-col mobile); both files contain the `TODO` comment; `npx tsc --noEmit` clean; `git diff --stat` shows ~140 LOC.

- [ ] **W2.7** `docs(sdd): sync REQUIREMENTS.md §2.A.4 Carrusel→Grid + new sections` (~25 LOC)
  - Modify `REQUIREMENTS.md:41` — change "Sección de Trabajos Realizados (Carrusel): Slider de imágenes interactivo y responsive" to "Sección de Trabajos Realizados (Grid de 6): CSS Grid de hasta 6 imágenes administrables" (REQ-BKG-006).
  - Add 4 new sections to `REQUIREMENTS.md §2.A`: Sobre mí, Cómo reservar, Testimonios, FAQ (each with one-line behavioural description).
  - Append `home-static-content` line to `ARCHITECTURE.md` (+3 LOC).
  - Append `DOCUMENTATION.md` changelog entry for PR 2 phase completion (+10 LOC, e.g. "2026-07-03 — Public FE: 5 new Home sections + lightbox merged").
  - **MUST land last in PR 2** — if docs drift, R2 fires.
  - **AC**: `grep -i "carrusel" REQUIREMENTS.md` returns 0 lines; Lighthouse "Properly defines `<link rel="icon">`" check still passes (inherited); `git diff --stat` shows ~25 LOC.

### PR 3 — Admin frontend (4 work-units, ~285 LOC)

Target branch: `feat/home-static-sections-pr3-admin-fe` (branched from `main` after PR 1 merges; parallel with PR 2).

> **Work-unit commit W3.2 split**: the design lists `feat(sdd): GallerySection admin component` as one commit at ~200 LOC. Per the 150-LOC work-unit budget, split into W3.2a (slot editor list with debounced preview) and W3.2b ("+ Nuevo slot" toolbar + delete confirm). Total LOC unchanged.

- [ ] **W3.1** `chore(sdd): add admin gallery API helpers + useAdminGallery hook` (~50 LOC)
  - Append `GalleryItemCreate` + `GalleryItemUpdate` types and 3 functions (`createGalleryItem`, `updateGalleryItem`, `deleteGalleryItem`) to `frontend/src/api.ts` (~20 LOC).
  - Append 3 mutations to `frontend/src/hooks/useGallery.ts`: `useCreateGalleryItem`, `useUpdateGalleryItem`, `useDeleteGalleryItem` — each invalidates `['gallery']` on success (~30 LOC).
  - Re-export the 3 mutations from `frontend/src/hooks/index.ts` (+3 LOC).
  - **AC**: `npx tsc --noEmit` clean; mutations export correctly; `git diff --stat` shows ~50 LOC.

- [ ] **W3.2a** `feat(sdd): GallerySection admin slot editor list with thumbnail preview` (~140 LOC)
  - Create `frontend/src/components/admin/GallerySection.tsx` — part 1 of 2 (140 LOC). Self-contained (no prop drilling — uses its own `useGallery` + admin mutations, per design §6.6).
  - Renders 6 slot editors in a vertical list (one per `orden` 1..6, even if inactive). Per-slot inputs: `image_url` (with debounced 300ms thumbnail preview per D12), `alt_text` (with character counter 0/200, mandatory, disables "Guardar" when empty per REQ-HGAL-051), `link_url` (optional, with "sin link" affordance for `null`), `activo` toggle, "Guardar" button.
  - Inactive rows render with `opacity: .5` and a small "Inactivo" label (mirrors `ServicesSection.tsx:125-127`).
  - **AC**: 6 slot editors visible; debounced preview appears within 500ms of URL paste; `alt_text` empty disables Guardar; `npx tsc --noEmit` clean; `git diff --stat` shows ~140 LOC.

- [ ] **W3.2b** `feat(sdd): GallerySection admin Nuevo slot button + delete confirm` (~60 LOC)
  - Append to `frontend/src/components/admin/GallerySection.tsx` (60 LOC). The "+ Nuevo slot" button (REQ-HGAL-052) — disabled when 6 slots exist, calls `POST /gallery` with the next free `orden` (lowest 1..6 not currently used). "Eliminar" button per slot with `window.confirm("Eliminar este slot?")` (REQ-HGAL-051).
  - **AC**: "+ Nuevo slot" disabled at 6 slots; delete confirm dialog appears before DELETE fires; `npx tsc --noEmit` clean; `git diff --stat` shows ~60 LOC.

- [ ] **W3.3** `feat(sdd): wire GallerySection into Admin.tsx collapsible` (~35 LOC)
  - Modify `frontend/src/pages/Admin.tsx`. Add `'galeria'` to `COLLAPSIBLE_IDS` at `Admin.tsx:60` (+1 LOC). Insert a new `<details open={collapsiblesState.galeria} onToggle={...} className="admin-card collapsible-card mt-4">` block between the Servicios collapsible (ends `Admin.tsx:576`) and the Configuración collapsible (starts `Admin.tsx:579`) (+34 LOC). Default open = `false` on first visit (matches existing pattern for new IDs at `Admin.tsx:64`).
  - Append `DOCUMENTATION.md` changelog entry for PR 3 phase completion (+5 LOC).
  - **AC**: admin sees the new "Galería de Trabajos" collapsible at the right position; `localStorage` persists its state; `npx tsc --noEmit` clean; `git diff --stat` shows ~35 LOC.

### PR 4 — Brand shell (2 work-units, ~48 LOC)

Target branch: `feat/home-static-sections-pr4-brand-shell` (branched from `main@615cd76`; **can run in parallel with PR 1** — disjoint file sets).

> **Binary assets inherited from PR #54**: `frontend/public/logo.png` (6.5 KB), `favicon.ico` (381 B), `favicon-32x32.png` (822 B), `apple-touch-icon.png` (24.9 KB). Total ~32.5 KB, well under the 100 KB budget. **Not regenerated in this PR** (D4, design §7.1).
> **Favicon links in `index.html` already in main from PR #54** — W4.2 does NOT touch `index.html`.

- [ ] **W4.1** `feat(sdd): extract Navbar.tsx from App.tsx (R14 mitigation)` (~45 LOC net)
  - Create `frontend/src/components/layout/Navbar.tsx` (150 LOC, NEW). Move `App.tsx:107-215` (nav, mobile drawer, focus trap, `useAuth` wiring, social icons, brand image) into this file.
  - `Navbar.tsx` accepts an `isLoading?: boolean` prop — lifts the auth-loading skeleton (previously `App.tsx:88-105`, 18 LOC inline) into the component (R14 mitigation per design §7.2).
  - `App.tsx` shrinks from 260 → ~155 LOC (-105 net). The `isDesktop` state stays in `App.tsx` (used by both Navbar mobile drawer and the FAB) and is passed down as a prop (`<Navbar isDesktop={isDesktop} />`).
  - The auth-loading branch in `App.tsx` becomes 7 LOC: `<Navbar isLoading />` instead of an 18-LOC inline skeleton (strict improvement — no duplication, R14).
  - **AC**: navbar renders identically to pre-refactor; mobile drawer focus trap still cycles correctly; auth-loading skeleton renders via `<Navbar isLoading />`; `npx tsc --noEmit` clean; `git diff --stat` shows ~45 LOC net.

- [ ] **W4.2** `chore(sdd): bump logo size from 36×36 to 48×48 (D10)` (~3 LOC)
  - Modify `Navbar.tsx`: change `width={36} height={36}` to `width={48} height={48}` on the brand `<img src="/logo.png" alt={businessName} ...>` (+1 LOC).
  - Modify `frontend/src/index.css:192` (`.navbar-brand-logo` rule): change `width: 36px; height: 36px;` to `width: 48px; height: 48px;` (+1 LOC rule change, +0 net LOC).
  - Append `DOCUMENTATION.md` changelog entry for PR 4 phase completion (+5 LOC, e.g. "2026-07-03 — Brand shell: Navbar extracted, logo 36→48").
  - **AC**: navbar logo is visibly larger (33% increase, 36→48) without wrapping the brand text; fits comfortably in 68px navbar height with 10px top + bottom padding; `npx tsc --noEmit` clean; `git diff --stat` shows ~3 LOC.

---

## File-level scope per task (cumulative)

The table below maps every work-unit to the files it touches. Pre-existing file line counts (from `wc -l` on `main@615cd76`): `App.tsx` 260, `Admin.tsx` 632, `Home.tsx` 191, `api.ts` 477, `index.css` 630, `main.py` 1392, `models.py` 114, `schemas.py` 401, `test_api.py` 3115.

| Work-unit | Files | LOC delta | Depends on |
|-----------|-------|-----------|------------|
| W1.1 | `backend/app/models.py` (+15), `backend/app/database.py` (+3), `ARCHITECTURE.md` (+5), `DOCUMENTATION.md` (+5) | +28 | — |
| W1.2 | `backend/app/schemas.py` (+55), `backend/tests/test_gallery.py` (+40) | +95 | W1.1 |
| W1.3 | `backend/app/main.py` (+25), `backend/tests/test_gallery.py` (+50) | +75 | W1.1, W1.2 |
| W1.4 | `backend/app/main.py` (+30), `backend/tests/test_gallery.py` (+40) | +70 | W1.1, W1.2, W1.3 |
| W1.5 | `backend/app/main.py` (+30), `backend/tests/test_gallery.py` (+60) | +90 | W1.1-W1.4 |
| W1.6 | `backend/app/main.py` (+13), `backend/tests/test_gallery.py` (+25) | +38 | W1.1-W1.5 |
| W2.1 | `frontend/src/api.ts` (+15), `frontend/src/hooks/useGallery.ts` (NEW, +50), `frontend/src/hooks/index.ts` (+1), `frontend/vite.config.ts` (+1) | +67 | PR 1 merged |
| W2.2a | `frontend/src/components/public/GallerySection.tsx` (NEW, +95), `frontend/src/index.css` (+35) | +130 | W2.1 |
| W2.2b | `frontend/src/components/public/Lightbox.tsx` (NEW, +50), `frontend/src/index.css` (+20) | +70 | W2.2a |
| W2.3 | `frontend/src/pages/Home.tsx` (+60) | +60 | W2.1, W2.2a, W2.2b |
| W2.4 | `frontend/src/components/public/AboutMeSection.tsx` (NEW, +35) | +35 | W2.3 |
| W2.5 | `frontend/src/components/public/HowToBookSection.tsx` (NEW, +55) | +55 | W2.3 |
| W2.6 | `frontend/src/components/public/TestimonialsSection.tsx` (NEW, +60), `frontend/src/components/public/FaqSection.tsx` (NEW, +80) | +140 | W2.3 |
| W2.7 | `REQUIREMENTS.md` (+25), `ARCHITECTURE.md` (+3), `DOCUMENTATION.md` (+10) | +38 | W2.1-W2.6 |
| W3.1 | `frontend/src/api.ts` (+20), `frontend/src/hooks/useGallery.ts` (+30), `frontend/src/hooks/index.ts` (+3) | +53 | PR 1 merged |
| W3.2a | `frontend/src/components/admin/GallerySection.tsx` (NEW, +140) | +140 | W3.1 |
| W3.2b | `frontend/src/components/admin/GallerySection.tsx` (+60) | +60 | W3.2a |
| W3.3 | `frontend/src/pages/Admin.tsx` (+35), `DOCUMENTATION.md` (+5) | +40 | W3.2b |
| W4.1 | `frontend/src/components/layout/Navbar.tsx` (NEW, +150), `frontend/src/App.tsx` (-105) | +45 | — |
| W4.2 | `Navbar.tsx` (+1), `frontend/src/index.css` (+0 net), `DOCUMENTATION.md` (+5) | +6 | W4.1 (or can ship in same PR; trivial size) |

**Per-PR subtotals**: PR 1 = +396; PR 2 = +595; PR 3 = +293; PR 4 = +51. **Grand total: ~1,335 source LOC** (slightly under the design's 1,415 estimate; the W2.2a/W2.2b and W3.2a/W3.2b splits consolidate CSS into the component commits).

---

## Acceptance criteria per task

Each task above carries inline AC. Aggregated by phase:

### PR 1 — Backend (strict TDD: RED → GREEN → REFACTOR for every work-unit)
- `python -m pytest backend/tests/test_gallery.py -v` — green, **21 tests** (16 baseline + 5 risk-driven for R12/R13).
- `python -m pytest` (full suite) — green, no regressions in the existing 182 tests.
- `GET /gallery` returns 200 with 6 items ordered by `orden`, no auth required.
- `POST /gallery` returns 401 without auth, 422 on bad input, 409 on `orden_conflict`, 201 on success.
- `PATCH /gallery/{id}` does partial update, 404 on missing id.
- `DELETE /gallery/{id}` returns 204.
- `seed_default_gallery` is idempotent (re-running on a populated DB inserts 0 rows).
- The R12 trailing-slash verification: admin POSTs `https://example.com` (no trailing slash), the DB stores it as `https://example.com`, `GET /gallery` returns `https://example.com` (no slash appended).

### PR 2 — Public frontend
- `npx tsc --noEmit` clean.
- DOM order matches locked: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación.
- With 0 active gallery items, the Galería section shows the empty state "Galería sin imágenes activas por el momento".
- With 6 active items, the grid shows 6 images with `loading="lazy"`, no CLS (Lighthouse CLS < 0.1).
- Clicking an image with `link_url` opens it in a new tab with `rel="noopener noreferrer"`.
- Clicking an image without `link_url` opens the lightbox. Escape closes. Tab is trapped. Body scroll is locked while open. Focus returns to the thumbnail on close.
- `grep -i "carrusel" REQUIREMENTS.md` returns 0 lines (R2 mitigation, must land last in PR 2).
- Sobre mí has 2-3 paragraphs, 80-150 words total, first-person warm tone.
- FAQ is multi-open (clicking one does NOT close the others).
- Lightbox close button is ≥44×44px (WCAG 2.5.8).
- Sobre mí, Testimonios, FAQ copy approved by the user before verify passes (REQ-HSSC-060, REQ-HSSC-061).

### PR 3 — Admin frontend
- `npx tsc --noEmit` clean.
- Admin sees 6 pre-seeded inactive slots in a vertical list (REQ-HGAL-051).
- Admin edits a slot: paste image URL → see thumbnail preview within 500ms (300ms debounce + paint); type alt text; optionally paste link URL; toggle active; click "Guardar" → 200 from the backend, list refreshes.
- Admin deletes a slot → `window.confirm` dialog appears, 204 from backend, row disappears, the `orden` slot becomes free.
- Empty `alt_text` disables "Guardar" client-side (mirrors Pydantic 422, REQ-HGAL-051).
- "+ Nuevo slot" calls `POST /gallery` with the next free `orden`. Disabled when 6 slots exist.
- The new "Galería de Trabajos" `<details>` appears between Servicios and Configuración; persists open/closed in `localStorage`.

### PR 4 — Brand shell
- `npx tsc --noEmit` clean.
- Navbar renders identically to pre-refactor (no visual regression) APART from the logo being larger.
- The `<img src="/logo.png" alt={businessName} width={48} height={48}>` is correctly rendered.
- Mobile drawer focus trap still works (Escape closes, Tab cycles inside).
- The auth-loading skeleton renders via `<Navbar isLoading />` and is visually identical to the pre-refactor state (R14 mitigation).
- `frontend/public/` binary size is unchanged (~32.5 KB, well under the 100 KB budget — PR #54 emitted the binary).

---

## Verification gates per PR

Per design Appendix B, with explicit command + expected result for the orchestrator's `sdd-verify` phase:

| PR | Command | Expected result |
|---|---|---|
| **PR 1** | `python -m pytest backend/tests/test_gallery.py -v` | 21 passed, 0 failed |
| **PR 1** | `python -m pytest` | 203+ passed (182 baseline + 21 new), 0 failed |
| **PR 1** | `curl http://localhost:8000/gallery` (after `seed_default_gallery` runs) | 200, 6 items ordered by `orden` ASC |
| **PR 1** | Manual: POST `https://example.com` as image_url, then GET /gallery | URL is stored and returned as `https://example.com` (no trailing slash, R12) |
| **PR 2** | `npx tsc --noEmit` | 0 errors |
| **PR 2** | `npx vite build` | builds without warnings |
| **PR 2** | Lighthouse desktop run on `http://localhost:5173/` | CLS < 0.1, LCP < 2.5s, favicon link check passes |
| **PR 2** | Manual screen-reader pass (VoiceOver or NVDA) on the lightbox | `role="dialog"` + `aria-modal="true"` + focus trap announced correctly |
| **PR 2** | User voice review of Sobre mí / Testimonios / FAQ copy | 3 explicit confirmations in chat; orchestrator removes the `TODO` comments in a follow-up commit |
| **PR 2** | `grep -i "carrusel" REQUIREMENTS.md` | 0 lines |
| **PR 3** | `npx tsc --noEmit` | 0 errors |
| **PR 3** | Manual smoke: login as admin, edit 2 slots, reload public Home | Both slots appear on Home after reload; thumbnails render |
| **PR 3** | Manual: paste a 404 URL, click Guardar | client-side reject with "Alt text es obligatorio" OR image-onerror fallback message visible |
| **PR 3** | Manual: click "+ Nuevo slot" when 6 slots exist | button is disabled |
| **PR 4** | `npx tsc --noEmit` | 0 errors |
| **PR 4** | Visual smoke: navbar looks the same except the logo is larger | Logo is visibly 33% larger; no layout shift |
| **PR 4** | Manual: open mobile drawer, press Tab several times | focus cycles inside drawer (Tab + Shift+Tab) |
| **PR 4** | Manual: press Escape while drawer is open | drawer closes, focus returns to hamburger button |
| **PR 4** | Manual: trigger auth-loading state | `<Navbar isLoading />` skeleton matches the pre-refactor inline skeleton |

---

## Dependency graph between tasks

### Critical path (must be sequential)

```
PR 1: W1.1 → W1.2 → W1.3 → W1.4 → W1.5 → W1.6
PR 2: W2.1 → W2.2a → W2.2b → W2.3 → W2.4 / W2.5 / W2.6 (parallel) → W2.7
PR 3: W3.1 → W3.2a → W3.2b → W3.3
PR 4: W4.1 → W4.2
```

### Cross-PR dependencies

```
PR 1 ─────────┬─► PR 2
              └─► PR 3

(PR 4 has no cross-PR deps)
```

### Parallelizable work-units (within and across PRs)

- **PR 1 ‖ PR 4**: disjoint file sets (`backend/app/*` + `tests/` + `ARCHITECTURE.md` vs `frontend/src/components/layout/Navbar.tsx` + `frontend/src/App.tsx` + `frontend/src/index.css`). Both branch from `main@615cd76`. **Can be developed in parallel from day 1.** PR 1 cannot merge before the apply phase finishes its 6 work-units; PR 4 cannot merge before the apply phase finishes its 2 work-units. Both target `main` independently.
- **W2.4 ‖ W2.5 ‖ W2.6** (within PR 2): the 3 copy/section work-units touch different files (`AboutMeSection.tsx` / `HowToBookSection.tsx` / `TestimonialsSection.tsx` + `FaqSection.tsx`). They all depend on W2.3 (Home.tsx rewire) but are independent of each other.
- **PR 2 ‖ PR 3** (after PR 1 merges): different file sets (`frontend/src/components/public/*` vs `frontend/src/components/admin/*`). PR 2 needs the public GET endpoint; PR 3 needs the admin POST/PATCH/DELETE endpoints. Both need PR 1 to have merged, but neither needs the other.

### Visual dependency graph (ASCII)

```
                    ┌─► W1.2 ─► W1.3 ─► W1.4 ─► W1.5 ─► W1.6 ─► PR 1 done
W1.1 ───────────────┤
                    │
                    └─► W2.1 ─► W2.2a ─► W2.2b ─► W2.3 ─┬─► W2.4 ─┐
                                                        ├─► W2.5 ─┼─► W2.7 ─► PR 2 done
                                                        └─► W2.6 ─┘
                                                                        ▲
                                                        ┌─► W2.4 ──────┘
                                                        │ (independent)
                                                        └─► W2.5
                                                        └─► W2.6

                              ┌─► W3.1 ─► W3.2a ─► W3.2b ─► W3.3 ─► PR 3 done
PR 1 done ───────────────────┤
                              └─► (PR 2 in parallel)

W4.1 ─► W4.2 ─► PR 4 done   (parallel with PR 1, no cross-deps)
```

---

## PR merge order

Per the `stacked-to-main` strategy (D17) and design §10.5:

1. **PR 1 (Backend)** — first, lands in `main`. Enables PR 2 and PR 3 to start.
2. **PR 4 (Brand shell)** — can land **in parallel with PR 1** (disjoint file sets, no deps). In practice, PR 4 may merge first or last — the order is flexible. Recommended slot: land PR 4 second (after PR 1) so the change ships in one wave, but the orchestrator is not blocked on it.
3. **PR 2 (Public FE)** — second (or third, after PR 4), depends on PR 1 endpoint.
4. **PR 3 (Admin FE)** — third (or fourth), depends on PR 1 endpoints; **can run in parallel with PR 2** (different components).

**Realistic timeline** (parallel execution):
- Day 1-3: PR 1 + PR 4 in parallel
- Day 3-5: PR 2 + PR 3 in parallel
- Day 5-6: process gate (user reviews copy)
- Day 6: verify + archive

**The 3 copy commits in PR 2 are isolated and revertable** (REQ-HSSC-061). If the user is busy, PR 2 can land with placeholder copy and the approved copy lands in a follow-up commit.

---

## Risk-driven task additions

The design's §11 surfaces 3 new risks (R12-R14) not in the proposal. Each is mitigated by a task in this breakdown. **No additional tasks beyond the 4-PR baseline are needed — all 3 risks are addressed inline in existing work-units, plus a verification gate.**

### R12 — `HttpUrl` trailing-slash wire-format quirk (Pydantic v2)

**Mitigation**: `backend/app/models.py` `image_url` / `link_url` columns are `str`, not `HttpUrl`. `HttpUrl` is only on the wire (Create/Update schemas). Stored value is the admin's raw input. On read, `GalleryItemRead.image_url: str` returns the stored string — no transformation, no trailing slash appended. Implemented in **W1.1** (model columns) and **W1.2** (schemas).

**Verification task** (no new code; gates the verify phase): in PR 1's verify gate, the orchestrator runs an explicit test asserting that POST `https://example.com` (no trailing slash) round-trips as `https://example.com` (no slash). This is a one-liner addition to `TestGalleryPublicGet` — counted in W1.6's 21-test total.

### R13 — Active-only partial unique index not portable to SQLite

**Mitigation**: route-level `SELECT * FROM galleryitem WHERE orden = :orden AND activo = true AND id != :exclude_id` in `POST /gallery` and `PATCH /gallery/{id}`. Returns 409 with `detail: "orden_conflict: ya existe un slot activo con orden=N"`. The DB column has no `unique=True` (the partial-index portability issue is sidestepped). Implemented in **W1.4** (POST) and **W1.5** (PATCH).

**Verification task** (no new code; gates the verify phase): two explicit tests in `TestGalleryAdminCreate` (counted in W1.4's 4 tests):
- `test_create_with_duplicate_active_orden_returns_409` (already in design W1.4).
- `test_create_with_inactive_duplicate_orden_succeeds` (R13-specific, adds 1 test to W1.4 — also matches the spec REQ-HGAL-020 scenario "Conflicto de orden entre activos").

**Net effect on test count**: design floor was 16 tests, design estimate 16-18, this breakdown ships 21 tests (16 baseline + 4 schema + 1 R13 specific). Within the design's margin for refactor-revealed edge cases.

### R14 — Auth-loading skeleton navbar duplication

**Mitigation**: PR 4's `Navbar.tsx` accepts an `isLoading?: boolean` prop and renders the auth-loading skeleton internally (the previously-inline 18-LOC block in `App.tsx:88-105` is replaced by a 7-LOC call to `<Navbar isLoading />`). Strict improvement — no duplication, single source of truth. Implemented in **W4.1**.

**Verification task**: the PR 4 verify gate includes a manual check that the auth-loading skeleton renders identically to the pre-refactor state (already in the verification gates table above).

---

## Open questions

Two minor items from design §14 that the apply phase should resolve, not blockers:

1. **Number of pytest cases in `test_gallery.py`** — the proposal says "≥ 10", the design estimates 16-18, this breakdown ships 21. The exact count may grow during the apply phase if TDD red-green cycles surface additional behaviors. **Decision**: 21 is the target floor; the apply phase may add 1-3 more if RED-GREEN reveals edge cases. No user input needed.

2. **Testimonials card name initials vs full avatars** — the design leaves the choice to the apply phase. **Decision**: default to **generic name + initial badge** (e.g., "ML" for "María L." in a 36×36 round badge matching `.navbar-brand-logo`'s gradient). Full avatars would require 3 more image URLs the admin would have to manage — out of scope. If the user wants full avatars in the future, the spec REQ-HSSC-030 allows it via a follow-up change. No user input needed at apply time.

**No other open questions**. All 8 design-level questions and 2 user-decision items (chain strategy + logo size) are locked.

---

## Constraints honored

- **No Co-Authored-By** in any commit the tasks might cause to be written (the apply phase will follow this rule — noted in the user instructions).
- **Work-unit commits ≤ 150 LOC** — the 2 design commits that exceeded this (PR 2 #2, PR 3 #2) are split further in this breakdown.
- **Strict TDD for backend** — every backend code change (W1.2-W1.6) is preceded by a failing test. W1.1 is the model class only, exercised by the endpoint tests.
- **Process gates are tasks** — Sobre mí / Testimonios / FAQ copy approval is tracked in W2.4 / W2.6 (with `TODO(sdd):` comments) and gated by the verify phase.
- **No emojis** in the tasks artifact.
- **4-PR breakdown unchanged** — no flag against the design's lock.

---

## Relevant files (created or modified by these tasks)

**Created**:
- `backend/tests/test_gallery.py` (PR 1, ~225 LOC)
- `frontend/src/hooks/useGallery.ts` (PR 2 + PR 3, ~80 LOC)
- `frontend/src/components/public/GallerySection.tsx` (PR 2, ~95 LOC)
- `frontend/src/components/public/Lightbox.tsx` (PR 2, ~50 LOC)
- `frontend/src/components/public/AboutMeSection.tsx` (PR 2, ~35 LOC)
- `frontend/src/components/public/HowToBookSection.tsx` (PR 2, ~55 LOC)
- `frontend/src/components/public/TestimonialsSection.tsx` (PR 2, ~60 LOC)
- `frontend/src/components/public/FaqSection.tsx` (PR 2, ~80 LOC)
- `frontend/src/components/admin/GallerySection.tsx` (PR 3, ~200 LOC)
- `frontend/src/components/layout/Navbar.tsx` (PR 4, ~150 LOC)

**Modified**:
- `backend/app/models.py` (+15)
- `backend/app/schemas.py` (+55)
- `backend/app/main.py` (+110, seed + 4 endpoints + lifespan)
- `backend/app/database.py` (+3, doc comment)
- `frontend/src/api.ts` (+55, public + admin helpers)
- `frontend/src/hooks/index.ts` (+4, re-exports)
- `frontend/src/index.css` (+90, gallery + FAQ + testimonials + how-to-book + lightbox + logo size bump)
- `frontend/src/pages/Home.tsx` (+60, 5 → 10 sections)
- `frontend/src/pages/Admin.tsx` (+35, `'galeria'` collapsible)
- `frontend/src/App.tsx` (-105, navbar extracted)
- `frontend/vite.config.ts` (+1, `/gallery` proxy)
- `ARCHITECTURE.md` (+8, `Galería` + `home-static-content`)
- `REQUIREMENTS.md` (+25, §2.A.4 + 4 new sections)
- `DOCUMENTATION.md` (+25, 4 changelog entries)

**Untouched** (inherited from PR #54):
- `frontend/public/logo.png`, `frontend/public/favicon.ico`, `frontend/public/favicon-32x32.png`, `frontend/public/apple-touch-icon.png` — all in `main@615cd76`.
- `frontend/index.html` — 3 favicon links already in main.
