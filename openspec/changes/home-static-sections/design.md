# Design: `home-static-sections`

**Change**: `home-static-sections` | **Phase**: design | **Strict TDD**: ACTIVE for backend
**Source artifacts**: `proposal.md`, `specs/{home-gallery,home-static-content,online-booking}/spec.md`
**Status**: Ready for `sdd-tasks` after user picks chain strategy (see §13) and approves logo size bump (see §7).
**Branch strategy**: 4 chained PRs against tracker `feat/home-static-sections` from `origin/main` (`615cd76`, includes PR #54 brand-shell hotfix).

---

## 1. Architecture overview

### 1.1 Component boundaries

Four logical boundaries, each owned by exactly one PR:

| Boundary | Owns | PR | Touches |
|---|---|---|---|
| **Backend** | `GalleryItem` SQLModel, 4 Pydantic schemas, 4 HTTP endpoints, `seed_default_gallery` | 1 | `backend/app/{models,schemas,main,database}.py`, `backend/tests/test_gallery.py` |
| **Public FE** | 5 new sections (Galería + 4 content-only), `Lightbox`, `useGallery`, `Home` rewire, CSS | 2 | `frontend/src/components/public/*.tsx`, `frontend/src/hooks/useGallery.ts`, `frontend/src/pages/Home.tsx`, `frontend/src/index.css`, `frontend/src/api.ts`, `frontend/vite.config.ts` |
| **Admin FE** | Admin CRUD-with-list for 6 gallery slots, `useAdminGallery`, `Admin.tsx` 6th `<details>` | 3 | `frontend/src/components/admin/GallerySection.tsx`, `frontend/src/hooks/useGallery.ts` (mutations), `frontend/src/api.ts`, `frontend/src/pages/Admin.tsx` |
| **Brand shell** | Navbar extraction from `App.tsx`, logo size bump, Navbar `<img>` + CSS update | 4 | `frontend/src/components/layout/Navbar.tsx` (NEW), `frontend/src/App.tsx` (-100 LOC net), `frontend/src/index.css` (`.navbar-brand-logo` update). Binary assets + `index.html` favicon links ALREADY in `origin/main` (PR #54) — PR 4 does NOT touch them. |

These are the same four boundaries the proposal locked. The public-FE and admin-FE hooks share a single `useGallery.ts` file (read in PR 2, mutations added in PR 3) to avoid splitting the cache key namespace across two files.

### 1.2 Data flow (admin saves gallery slot → public Home re-renders)

```
┌────────────────────┐                         ┌────────────────────┐
│  Admin (browser)   │                         │ Public (browser)   │
│  /admin (auth)     │                         │ / (anonymous)      │
└────────┬───────────┘                         └──────────┬─────────┘
         │                                               │
         │ PATCH /gallery/{id}                           │ GET /gallery
         │ (Bearer token, 200 OK)                        │ (no auth, 200 OK)
         ▼                                               ▼
┌────────────────────────────────────────────────────────────────────┐
│  FastAPI (backend/app/main.py)                                    │
│  ┌──────────────────┐         ┌──────────────────────────────┐     │
│  │ PATCH /gallery/  │  write  │  GalleryItem (SQLModel,      │     │
│  │ {id}             │────────▶│  table=True)                 │     │
│  │ Depends(         │         │  + 5 sibling tables          │     │
│  │   get_current_   │         └──────────────┬───────────────┘     │
│  │   user)          │                        │                     │
│  └──────────────────┘         ┌──────────────▼───────────────┐     │
│                              │  SQLite (dev) / Postgres     │     │
│                              │  (prod) — same SQLModel      │     │
│                              └──────────────┬───────────────┘     │
│  ┌──────────────────┐                        │                     │
│  │ GET /gallery     │  read   ┌──────────────▼───────────────┐     │
│  │ (no auth)        │◀───────│  SELECT * FROM galleryitem   │     │
│  │                  │         │  ORDER BY orden ASC           │     │
│  └──────────────────┘         └──────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

Cache-invalidation flow:

1. Admin `PATCH /gallery/{id}` returns 200 with the updated item.
2. The admin's `useAdminGallery` mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['gallery'] })`.
3. The mutation's response body is the new server-state, so the admin's TanStack Query cache updates optimistically.
4. The public visitor's open browser holds a stale `['gallery']` cache. They see the update on the next page load (TanStack Query default `staleTime: 0` for this query — see §5.5) OR if they have the tab open and the cache invalidation broadcasts (it does NOT broadcast across browsers, by design).
5. There is no real-time sync. This matches the spec: "the public Home reflects changes on next page load" (proposal.md:83).

### 1.3 State management

- **Public read**: `useGallery()` hook (PR 2) returns `useQuery({ queryKey: ['gallery'], queryFn: getGallery, staleTime: 0 })`. Public data is cheap to refetch and changes are infrequent.
- **Admin mutations**: `useAdminGallery` exports `useCreateGalleryItem`, `useUpdateGalleryItem`, `useDeleteGalleryItem` (PR 3). Each mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['gallery'] })`.
- **No WebSocket / SSE** — the proposal explicitly does not add real-time sync. Public visitors see updates on next page load.

### 1.4 Peer pattern: where `Galería` lives in the model graph

The project has two peer patterns for sub-resources:
- **`Cliente` ↔ `ClienteTelefono`** (1:N — a `Cliente` has many phones, each with its own CRUD). See `models.py:34-40`.
- **`Configuracion`** (single-row scalar — flat key/value, no children). See `models.py:97-106`.

`Galería` is a **flat list** with no parent aggregate — 6 slots, no foreign key to anything else. The proposal locked it as **standalone `table=True`** (Approach A), mirroring the `ClienteTelefono` *shape* (own primary key, own CRUD) but NOT the parent relationship. Rationale:
- It is not a child of `Configuracion` (the proposal explicitly rejected that — would violate the single-row contract).
- It is not a child of `Cliente` (no client owns a gallery image).
- It IS admin-managed content that benefits from per-row Pydantic schemas and trivial CRUD — exactly what `ClienteTelefono` provides.

So `GalleryItem` is structurally a peer of `ClienteTelefono` (own PK, 4-endpoint CRUD trio + 1 public list) but with no `foreign_key` and a fixed `unique` constraint on `orden`.

---

## 2. Data model (PR 1)

### 2.1 `GalleryItem` SQLModel

New class appended to `backend/app/models.py`:

```python
class GalleryItem(SQLModel, table=True):
    __tablename__ = "galleryitem"
    id: Optional[int] = Field(default=None, primary_key=True)
    orden: int = Field(unique=True, ge=1, le=6)
    image_url: str = Field(max_length=2000)
    alt_text: str = Field(min_length=1, max_length=200)
    link_url: Optional[str] = Field(default=None, max_length=2000)
    activo: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
```

Field-by-field justification:

| Field | Type | Why |
|---|---|---|
| `id` | `Optional[int]`, PK | Matches `Servicio` / `ClienteTelefono` pattern (`models.py:36, 53`). `Optional` because it's `None` before INSERT; SQLModel fills it in. |
| `orden` | `int`, `unique=True, ge=1, le=6` | The slot number 1..6. `unique=True` enforces the spec REQ-HGAL-001 invariant that two rows cannot share `orden` — even inactive rows. Wait, see §8.1 for the override: spec REQ-HGAL-001 says uniqueness applies only between ACTIVE rows. Decision: use **partial unique index** (PostgreSQL `WHERE activo = true`, SQLite equivalent) — see §3.5 for the implementation trade-off. |
| `image_url` | `str`, `max_length=2000` | Validated as `HttpUrl` at the Pydantic layer (see §3). `max_length=2000` is a defensive cap — real URLs are < 500 chars, but a pasted Cloudinary URL with query params can hit 1000+. |
| `alt_text` | `str`, `min_length=1, max_length=200` | Mandatory, non-empty. Spec REQ-HGAL-002: 1..200 chars. |
| `link_url` | `Optional[str]`, `max_length=2000` | `null` = "use lightbox on click"; non-null = "open in new tab". Same length cap as `image_url`. |
| `activo` | `bool`, `default=False` | Slots ship inactive; the admin enables per-slot. Mirrors `Servicio.activo` default (`models.py:50`). |
| `created_at` / `updated_at` | `datetime`, default `now(timezone.utc)` | Audit timestamps. `updated_at` is bumped on every PATCH via the route, not via SQLAlchemy `onupdate` (we want explicit control, and SQLite ignores `onupdate` anyway). |

### 2.2 Migration contract: `SQLModel.metadata.create_all` is non-destructive

Adding a new `table=True` class to `models.py` is a no-op for migrations:

1. `create_db_and_tables()` (`database.py:27-30`) calls `SQLModel.metadata.create_all(engine)`.
2. `SQLModel.metadata.create_all` issues `CREATE TABLE IF NOT EXISTS` for every model — it does NOT touch existing tables.
3. The new `galleryitem` table materializes on the next startup automatically.
4. The custom `run_migration()` (`main.py:93-127`) is for `ALTER TABLE` on existing columns only. It does NOT run on new tables.

This is the same contract the project used when adding `ClienteTelefono` (peer pattern), `HorarioSemanal`, `ExcepcionHorario`, and `Usuario` — no manual migration was needed for any of them. PR 1 will add a one-line comment to `database.py:30` documenting this contract explicitly so future contributors do not panic.

**PostgreSQL production deployment**: the same `create_all` runs at startup in the Render dyno. The first deploy after PR 1 merges will create the table on the live DB. No downtime window, no separate migration script.

### 2.3 `seed_default_gallery(session)` contract

New function in `backend/app/main.py`, registered in the `lifespan` list (`main.py:174`):

```python
def seed_default_gallery(session: Session) -> None:
    existing = session.exec(select(GalleryItem)).first()
    if existing:
        return  # idempotent: no-op if any row exists
    for n in range(1, 7):
        session.add(GalleryItem(orden=n))  # all other fields default
    session.commit()
```

Contract:
- **Idempotent**: re-running on a populated DB inserts 0 rows. The guard is `first()` not `count()` — cheaper.
- **First-run only**: ships exactly 6 rows with `orden = 1..6`. All fields except `orden` use model defaults: `image_url=""` (placeholder), `alt_text=""` (placeholder), `link_url=None`, `activo=False`, `created_at=now`, `updated_at=now`.
- **Spec match**: REQ-HGAL-001 scenario "Tabla y 6 slots inactivos se crean al primer arranque".

Why placeholder `image_url=""` and `alt_text=""`? Because `alt_text` has `min_length=1` at the model level (set by `Field(min_length=1, ...)`) — but `min_length` on a SQLModel `Field` only applies to Pydantic validation, not to direct ORM `__init__`. Verified: SQLModel `Field(min_length=...)` does NOT block raw `GalleryItem(orden=1)` construction. The admin will fill these in via the panel before activating the slot.

If the team wants stricter seed safety, an alternative is to add a `model_validator` that rejects `image_url == ""` AND `activo == True` — but that complicates the seed (we'd need to allow empty URL on inactive). The current design: seed with empty string + admin must fill before activating. Documented as a UX constraint in the admin UI (work-unit 2 in PR 3).

---

## 3. Pydantic schemas (PR 1)

All in `backend/app/schemas.py`, appended after the existing `PublicAppointmentResponse`.

### 3.1 `GalleryItemRead`

```python
class GalleryItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    orden: int
    image_url: str
    alt_text: str
    link_url: Optional[str] = None
    activo: bool
    created_at: datetime
    updated_at: datetime
```

No `field_serializer` — `HttpUrl` is only used on the write paths (`Create`/`Update`). Reads always serialize as `str` (FastAPI's `response_model` is `GalleryItemRead`, but the raw ORM value is `str`, so this is automatic).

### 3.2 `GalleryItemCreate`

```python
class GalleryItemCreate(BaseModel):
    orden: int = Field(ge=1, le=6)
    image_url: HttpUrl  # rejects "not-a-url", "file://", "javascript:"
    alt_text: str = Field(min_length=1, max_length=200)
    link_url: Optional[HttpUrl] = None
    activo: bool = False
```

Validators:
- `orden: int = Field(ge=1, le=6)` — out-of-range returns 422 (spec REQ-HGAL-001 scenario "Create rechaza orden fuera de rango"). Uniqueness is enforced at DB level via `Field(unique=True)` on the model AND checked explicitly in the route (IntegrityError → 409).
- `image_url: HttpUrl` — Pydantic v2's `HttpUrl` accepts `http://` and `https://`, rejects `file://`, `javascript:`, `data:`, empty string, and anything without a scheme. Stored as `str(image_url)` in the ORM column.
- `alt_text: str = Field(min_length=1, max_length=200)` — empty string returns 422. The admin cannot save a slot with empty alt text (spec REQ-HGAL-002).
- `link_url: Optional[HttpUrl] = None` — same URL validation as `image_url`. `None` means "use lightbox".

**Wire format quirk**: Pydantic v2's `HttpUrl` validates and accepts a URL but serializes it with a trailing slash. e.g. `"https://example.com"` becomes `"https://example.com/"` when read back via `GalleryItemRead`. This is a known Pydantic v2 behavior. We bypass it by storing the raw string in the DB and only validating on the wire. The model column is `str` (not `HttpUrl`), so the canonical value is the admin's input. On read, `GalleryItemRead.image_url: str` returns the raw stored string.

**`model_config`**: NOT setting `from_attributes=True` on Create — Create is a wire-only schema. Reads use `from_attributes=True` for ORM → Pydantic conversion.

### 3.3 `GalleryItemUpdate`

```python
class GalleryItemUpdate(BaseModel):
    image_url: Optional[HttpUrl] = None
    alt_text: Optional[str] = Field(default=None, min_length=1, max_length=200)
    link_url: Optional[HttpUrl] = None
    activo: Optional[bool] = None
```

**`orden` is intentionally excluded from Update.** Spec REQ-HGAL-002: "orden cannot be changed (admin edits each slot by id, the orden is set on first create and stays)". If the admin wants to swap slot 3 and slot 5, they edit each individually (no drag-and-drop; out of scope per proposal.md:84).

**Partial update semantics**: the route uses `model_dump(exclude_unset=True)` (matching the existing `PATCH /services/{id}` pattern at `main.py:977`) so fields omitted from the request body are left untouched in the DB.

### 3.4 Why no `GalleryOrder` enum

The proposal hinted at "a `GalleryOrder` enum or validator if you recommend it" (instruction §3). **Decision: no enum.** Reasons:
- The slot number is a small int (1..6) — a Pydantic enum would add ceremony without value.
- The DB column is `int`, not a string enum — adding an enum at the schema layer would require a transform to int.
- `Field(ge=1, le=6)` already enforces the range and produces a 422 with a clear error.

The 6-slot fixed-size design is captured in the model (`Field(ge=1, le=6)`) and the seed (creates 1..6). The Pydantic schema is a thin wire-format adapter, not a domain model.

### 3.5 Uniqueness: DB-level vs app-level

The spec REQ-HGAL-001 states: "La unicidad de orden aplica sólo entre filas activas: dos slots inactivos con el mismo orden pueden coexistir, pero no dos filas activas con el mismo orden." That requires a **partial unique index** — a feature that exists in PostgreSQL (`CREATE UNIQUE INDEX ... WHERE activo`) but NOT in vanilla SQLite (SQLite supports `CREATE UNIQUE INDEX ... WHERE` only in some builds).

**Decision: enforce uniqueness at the application level, NOT the DB level.** Implementation:
- Drop `unique=True` from the model's `Field(orden=...)`. The column is a plain int with a check constraint `ge=1, le=6` (which is `Field`-level, runs in Pydantic only, not in SQLite DDL — that's fine).
- In `POST /gallery` and `PATCH /gallery/{id}`, the route explicitly queries `SELECT * FROM galleryitem WHERE orden = :orden AND activo = true AND id != :exclude_id` and returns 409 if any row matches.

This is uglier than a partial unique index, but it works on both SQLite and PostgreSQL with the same code. The trade-off is documented in §11 (Risk 12).

---

## 4. HTTP surface (PR 1)

All endpoints in `backend/app/main.py`. The 4 gallery endpoints cluster near the existing services endpoints (`main.py:962-997`) for discoverability.

| Method | Path | Auth | Behavior | Success | Failure |
|---|---|---|---|---|---|
| `GET` | `/gallery` | public | Returns all 6 slots (active + inactive), ordered by `orden` ASC. Filters nothing — the public frontend decides what to render. | 200 + `list[GalleryItemRead]` | 500 on DB error (vanishingly rare) |
| `POST` | `/gallery` | admin | Creates one slot. | 201 + `GalleryItemRead` | 401 (no auth), 422 (Pydantic), 409 (duplicate `orden` against an active row) |
| `PATCH` | `/gallery/{id}` | admin | Partial update. `model_dump(exclude_unset=True)` semantics — only fields present in the body are written. | 200 + `GalleryItemRead` | 401, 404 (id missing), 422, 409 (PATCH causes `orden` conflict — but `orden` is not in Update, so this branch is unreachable; documented for future-proofing) |
| `DELETE` | `/gallery/{id}` | admin | Hard delete. Matches `DELETE /services/{id}` shape. | 204 (no body) | 401, 404 |

### 4.1 Error response shape

All 4xx responses use FastAPI's default `{"detail": ...}` envelope. Pydantic 422s carry FastAPI's standard `detail: list[{type, loc, msg, input}]` shape. 409s use a custom `detail` string: `{"detail": "orden_conflict: ya existe un slot activo con orden=N"}` so the admin UI can branch on the literal `orden_conflict` prefix (same pattern as the existing `seña_excede_precio` literal-error convention at `schemas.py:122`).

### 4.2 Rate limiting: NO on `/gallery`

The existing public endpoints (`/public/clients`, `/public/appointments`) carry `@limiter.limit("10/minute")` (per-IP) and the appointment endpoint also has a per-DNI `3/day` shared limit. Both are motivated by abuse prevention on write paths (REQ-PUB-006, REQ-PUB-007).

`GET /gallery` is a **read-only public endpoint** that returns ≤ 6 small JSON objects. The cost of an unbounded GET is negligible (no PII, no DB write, no expensive join). Adding a rate limit would add operational complexity (slowapi key storage, monitoring) for zero practical benefit at this scale. **Decision: no rate limit on `/gallery`.** Same posture as `GET /services` and `GET /config`, which are also unauthenticated and unthrottled.

The three admin endpoints (`POST`, `PATCH`, `DELETE`) sit behind `Depends(get_current_user)`, which is a sufficient barrier — only authenticated users with a valid JWT can hit them, and the auth login endpoint is already throttled at `5/minute` (`main.py:24, 295`).

### 4.3 Idempotency keys: NOT NEEDED for v1

The proposal hints at this decision (§4 third paragraph). Confirmation: the admin endpoints are single-row CRUD with no money movement, no email trigger, no external side-effect. A double-click on "Guardar" results in two PATCHes that converge to the same final state (or one succeeds and one returns 404 if the first deletes the row). Adding idempotency keys would require:
- A new column on the request log table (or in-memory dict, which doesn't survive restart).
- A new field on the wire schema.
- A new test matrix (key reuse, key expiry).

**Decision: no idempotency keys.** If the admin user reports a double-submit bug, we add them in a follow-up. This matches the existing services endpoints (no idempotency).

### 4.4 Response model conventions

- `GET /gallery` uses `response_model=list[GalleryItemRead]`.
- `POST /gallery` uses `response_model=GalleryItemRead, status_code=201`.
- `PATCH /gallery/{id}` uses `response_model=GalleryItemRead` (200 implicit).
- `DELETE /gallery/{id}` uses `status_code=204` (no body, no `response_model`).

These mirror the existing services trio (`main.py:962-997`).

---

## 5. Public frontend (PR 2)

### 5.1 New components in `frontend/src/components/public/`

| File | LOC est. | Owns |
|---|---|---|
| `GallerySection.tsx` | 95 | CSS Grid wrapper, click handling (link vs lightbox), error fallback, empty state. |
| `Lightbox.tsx` | 50 | Custom modal: `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, body scroll lock, focus return. |
| `AboutMeSection.tsx` | 35 | 2-3 paragraphs first-person, `max-width: 720px`. |
| `HowToBookSection.tsx` | 55 | 3-4 `<ol>` steps, "Reservar Turno" CTA → `/reservar`. |
| `TestimonialsSection.tsx` | 60 | 3 cards (CSS Grid 1fr 1fr 1fr on desktop, 1fr on mobile). |
| `FaqSection.tsx` | 80 | 4-5 Q&A, **multi-open** accordion with `useState<Set<number>>`. |

All 6 use the shared `.section` + `.section-header` + `.overline` pattern from `index.css:218-224` and carry `aria-labelledby` pointing to the `<h2>` id (spec REQ-HSSC-002).

### 5.2 `Lightbox` — focus trap mirrors `App.tsx:53-87`

The existing mobile drawer focus-trap at `App.tsx:52-86` is the proven reference. `Lightbox.tsx` lifts the same pattern into a reusable hook `useFocusTrap` (inlined, not extracted, to keep the public-component file count low).

```ts
// Pseudocode — exact shape in tasks.md
const FOCUSABLE = 'a[href], button:not([disabled]), img[tabindex="0"]'
useEffect(() => {
  if (!open) return
  document.body.style.overflow = 'hidden'
  closeRef.current?.focus()
  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab' && ref.current) {
      // cycle inside ref
    }
  }
  document.addEventListener('keydown', handleKey)
  return () => {
    document.body.style.overflow = ''
    document.removeEventListener('keydown', handleKey)
  }
}, [open, onClose])
```

The component receives `open`, `onClose`, `src`, `alt`, and `triggerRef` (for focus return). On close, focus returns to the thumbnail that opened the lightbox — `GallerySection` passes the thumbnail `<button>` ref.

### 5.3 `useGallery` hook (public read)

`frontend/src/hooks/useGallery.ts` (NEW, ~50 LOC). Exports `useGallery()`:

```ts
export function useGallery() {
  return useQuery({
    queryKey: ['gallery'],
    queryFn: getGallery,
    staleTime: 0,           // always refetch on focus/mount
    gcTime: 5 * 60 * 1000,  // 5 min cache
    refetchOnWindowFocus: true,
  })
}
```

- **Cache key `['gallery']`** — single namespace, no array nesting (matches the project's `['services']`, `['config']` pattern from `useServices.ts` and `useConfig.ts`).
- **`staleTime: 0`** — gallery is small (≤ 6 items, < 1 KB) and changes are infrequent; the cost of a stale-while-revalidate cache is not worth the implementation complexity. Reload the data on focus.
- **Admin invalidation** — when an admin mutates (PR 3), the mutation's `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['gallery'] })`. Public visitors with the tab open will refetch on the next focus event.

### 5.4 `api.ts` helpers

Add to `frontend/src/api.ts` (PR 2, public side):

```ts
export type GalleryItemRead = {
  id: number
  orden: number
  image_url: string
  alt_text: string
  link_url: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export async function getGallery(): Promise<GalleryItemRead[]> {
  const r = await api.get('/gallery')
  return r.data
}
```

PR 3 will append `createGalleryItem`, `updateGalleryItem`, `deleteGalleryItem` to the same file.

### 5.5 `Home.tsx` rewire: 5 → 10 sections

Insertions in DOM order, between `Servicios` (`Home.tsx:58-106`) and `Conectemos` (`Home.tsx:110-159`):

```
Hero              ← existing (line 27-56)
Servicios         ← existing (line 58-106)
Galería           ← NEW (GallerySection)
Sobre mí          ← NEW (AboutMeSection)
Cómo reservar     ← NEW (HowToBookSection)
Testimonios       ← NEW (TestimonialsSection)
FAQ               ← NEW (FaqSection)
Conectemos        ← existing (line 110-159)
CTA               ← existing (line 161-167)
Ubicación         ← existing (line 169-188)
```

Each new section is a self-imported component. `Home.tsx` itself does not grow much — the imports list gains 5 lines, the JSX gains 5 lines (one per section). Net: +60 LOC.

### 5.6 `index.css` new classes

Append to `@layer components` (`index.css:181` onwards). All new classes follow the existing token-driven pattern (use `var(--primary)`, `var(--surface)`, etc., no new tokens):

```css
/* ── Gallery (REQ-HGAL-030, REQ-HSSC-001) ── */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.gallery-item {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: var(--radius-lg);
  border: 1px solid var(--outline-variant);
  background: var(--surface);
  cursor: pointer;
  transition: all .3s;
}
.gallery-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
.gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gallery-item-fallback {
  display: flex; align-items: center; justify-content: center;
  height: 100%; padding: 24px; text-align: center;
  color: var(--on-surface-variant); font-style: italic;
  font-size: .95rem; background: var(--surface);
}
.gallery-empty {
  text-align: center; padding: 48px 20px;
  color: var(--on-surface-variant); font-style: italic;
}

/* ── FAQ (REQ-HSSC-040 — multi-open) ── */
.faq-item { border-bottom: 1px solid var(--outline-variant); }
.faq-question {
  width: 100%; background: none; border: none; padding: 20px 0;
  text-align: left; font-family: var(--font-display); font-size: 1.1rem;
  font-weight: 600; color: var(--on-background);
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  cursor: pointer; min-height: 44px;
}
.faq-question:hover { color: var(--primary); }
.faq-question[aria-expanded="true"] .faq-chevron { transform: rotate(180deg); }
.faq-chevron { transition: transform .3s; flex-shrink: 0; }
.faq-panel {
  padding: 0 0 20px; color: var(--on-surface-variant); line-height: 1.7;
}

/* ── Testimonials (REQ-HSSC-030) ── */
.testimonials-grid {
  display: grid; gap: 24px;
  grid-template-columns: repeat(3, 1fr);
}
@media (max-width: 767px) { .testimonials-grid { grid-template-columns: 1fr; } }
.testimonial-card {
  background: var(--surface); border: 1px solid var(--outline-variant);
  border-radius: var(--radius-lg); padding: 32px 24px;
  position: relative; box-shadow: var(--shadow-sm);
}
.testimonial-card::before {
  content: '"'; position: absolute; top: 12px; left: 20px;
  font-family: var(--font-display); font-size: 4rem; line-height: 1;
  color: var(--primary); opacity: .3;
}
.testimonial-quote { font-style: italic; line-height: 1.6; margin-bottom: 16px; }
.testimonial-name { font-weight: 600; color: var(--on-background); }

/* ── How To Book (REQ-HSSC-020) ── */
.how-to-book-steps {
  list-style: none; counter-reset: step; padding: 0; margin: 0;
  display: grid; gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.how-to-book-steps li {
  counter-increment: step; position: relative; padding: 24px;
  background: var(--surface); border-radius: var(--radius-lg);
  border: 1px solid var(--outline-variant);
}
.how-to-book-steps li::before {
  content: counter(step, decimal-leading-zero);
  font-family: var(--font-display); font-size: 2.4rem; font-weight: 700;
  color: var(--primary); display: block; margin-bottom: 8px;
}

/* ── Lightbox (REQ-HGAL-040) ── */
.lightbox-backdrop {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0, 0, 0, .85);
  display: flex; align-items: center; justify-content: center;
  padding: 32px;
}
.lightbox-content {
  position: relative; max-width: min(90vw, 1200px); max-height: 90vh;
}
.lightbox-image { max-width: 100%; max-height: 90vh; object-fit: contain; display: block; }
.lightbox-close {
  position: absolute; top: -44px; right: 0; /* sits above the image */
  background: rgba(255, 255, 255, .15); color: #fff; border: none;
  border-radius: 50%; width: 40px; height: 40px;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 1.4rem; cursor: pointer;
  min-width: 44px; min-height: 44px; /* WCAG 2.5.8 */
}
.lightbox-close:hover { background: rgba(255, 255, 255, .25); }
```

Plus a single block to respect `prefers-reduced-motion` for the FAQ chevron:

```css
@media (prefers-reduced-motion: reduce) {
  .faq-chevron { transition: none; }
}
```

The existing global reduced-motion block at `index.css:128-136` already nulls `transition-duration` for `*` — this is belt-and-suspenders and costs 4 LOC.

### 5.7 `vite.config.ts` dev proxy

Add one line to the `server.proxy` block (`vite.config.ts:12-21`):

```ts
'/gallery': 'http://localhost:8000',
```

In production the frontend calls `VITE_API_URL` (`api.ts:5`) which is the Render backend URL — no proxy needed.

### 5.8 Accessibility decisions (locked)

| Concern | Decision |
|---|---|
| Image loading | `loading="lazy"` + `decoding="async"` on every `<img>` (REQ-HGAL-030). |
| CLS | Explicit `width={4 * 96}` `height={3 * 96}` on every `<img>` (384×288 in CSS pixels — matches the 4/3 aspect-ratio box). The `aspect-ratio: 4 / 3` on `.gallery-item` reserves the slot before the image loads. |
| Alt text | Required at the API layer. `GallerySection` never sets `alt=""`. If the image fails to load, the `<img onError>` swaps in the fallback block but the original `alt_text` stays in the DOM for screen readers. |
| Lightbox a11y | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to a hidden `<h2>` carrying the `alt_text`. Focus moves to the close button on open, returns to the thumbnail on close. |
| Body scroll lock | `document.body.style.overflow = 'hidden'` while open, restored on close. |
| Reduced motion | Global `index.css:128-136` already nulls all transitions. Lightbox has no transition of its own. |
| Target size | Close button is 44×44 (spec 44×44, minimum 24×24). The `.faq-question` button has `min-height: 44px`. The gallery thumbnails are large (full cell, ≥ 280×210). |
| Click target vs link | If `link_url` is set → `<a target="_blank" rel="noopener noreferrer">`. Else → `<button>` that opens lightbox. Data-driven per spec REQ-HGAL-031. |
| Focus order | Matches DOM order (top-left to bottom-right in the grid). The grid uses `auto-flow: row dense` (default), which preserves DOM order. |
| `aria-busy` on grid | While `useGallery().isLoading`, the grid carries `aria-busy="true"` and an `aria-label="Cargando galería"`. |

### 5.9 Locked decision: FAQ is **multi-open** accordion

`FaqSection.tsx` uses `useState<Set<number>>(new Set())`. Clicking a question adds its `id` to the set; clicking again removes it. Opening one does NOT remove the others. The `<button aria-expanded={openSet.has(q.id)}>` and `<div id={`faq-${q.id}-panel`} hidden={!openSet.has(q.id)}>` drive the visibility.

This overrides the proposal's recommendation in §8.7 (Q7) — locked in memory obs 2026-07-03.

---

## 6. Admin frontend (PR 3)

### 6.1 `GallerySection.tsx` mirrors `ServicesSection.tsx`

`frontend/src/components/admin/GallerySection.tsx` (NEW, ~200 LOC). Structural mirror of `ServicesSection.tsx:36-178`:

- Top block: 6 slot editors in a 2-column DataTable (or vertical list, locked to a vertical list per the spec REQ-HGAL-051).
- Per-slot inputs: `image_url` (with debounced thumbnail preview), `alt_text` (with character counter), `link_url` (optional, with "sin link" affordance for `null`), `activo` toggle, "Guardar" button, "Eliminar" button.
- Below the list: a "+ Nuevo slot" button that calls `POST /gallery` with the next free `orden`. Disabled when 6 slots exist (REQ-HGAL-052).

### 6.2 Slot editor structure (per slot)

```
┌─────────────────────────────────────────────────────────────┐
│ Slot 3 (orden = 3)                          [Activo ✓]      │
│                                                              │
│ image_url  [_________________________]  [thumbnail 60x60]   │
│ alt_text   [_________________________]  (45/200)             │
│ link_url   [_________________________]  (opcional)           │
│                                                              │
│                              [Guardar]  [Eliminar]           │
└─────────────────────────────────────────────────────────────┘
```

The thumbnail preview is a 60×60 `<img>` with the same `onError` fallback pattern (small block with italic "Sin preview"). The debounce is a `useEffect` with a 300ms `setTimeout` (matches proposal §8.6).

### 6.3 `useAdminGallery` hook (PR 3 mutations)

Append to `frontend/src/hooks/useGallery.ts`:

```ts
export function useCreateGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GalleryItemCreate) => createGalleryItem(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gallery'] }),
  })
}

export function useUpdateGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GalleryItemUpdate }) =>
      updateGalleryItem(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gallery'] }),
  })
}

export function useDeleteGalleryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteGalleryItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gallery'] }),
  })
}
```

Re-export from `frontend/src/hooks/index.ts` so the admin page can import them in a single line.

### 6.4 `api.ts` admin helpers (PR 3)

Append:

```ts
export type GalleryItemCreate = {
  orden: number
  image_url: string
  alt_text: string
  link_url?: string | null
  activo?: boolean
}

export type GalleryItemUpdate = {
  image_url?: string
  alt_text?: string
  link_url?: string | null
  activo?: boolean
}

export async function createGalleryItem(payload: GalleryItemCreate): Promise<GalleryItemRead> {
  const r = await api.post('/gallery', payload)
  return r.data
}

export async function updateGalleryItem(id: number, payload: GalleryItemUpdate): Promise<GalleryItemRead> {
  const r = await api.patch(`/gallery/${id}`, payload)
  return r.data
}

export async function deleteGalleryItem(id: number): Promise<void> {
  await api.delete(`/gallery/${id}`)
}
```

### 6.5 `Admin.tsx` integration

Add `'galeria'` to `COLLAPSIBLE_IDS` at `Admin.tsx:60`:

```ts
const COLLAPSIBLE_IDS = ['excepciones', 'clientes', 'horarios', 'servicios', 'galeria', 'configuracion'] as const
```

Insert a new `<details>` block between the Servicios collapsible (ends `Admin.tsx:576`) and the Configuración collapsible (starts `Admin.tsx:579`):

```tsx
{/* ── GALERÍA ── */}
<details
  open={collapsiblesState.galeria}
  onToggle={(e) => setCollapsible('galeria', e.currentTarget.open)}
  className="admin-card collapsible-card mt-4"
>
  <summary>
    Galería de Trabajos
    <span className="chevron">›</span>
  </summary>
  <div className="collapsible-body">
    <GallerySection />
  </div>
</details>
```

The `localStorage` persistence at `Admin.tsx:57-90` is keyed on the `COLLAPSIBLE_IDS` array, so the new `galeria` id gets the free default `false` (closed) on first visit, matching the existing pattern (the proposal said "default false for new IDs at `Admin.tsx:64`").

### 6.6 `GallerySection` self-contained — no prop drilling

Unlike `ServicesSection`, which receives 18 props from `Admin.tsx` (`ServicesSection.tsx:15-34`), the new `GallerySection` is self-contained: it owns its own `useGallery()` query, its own mutations, and its own per-slot state. This keeps the change to `Admin.tsx` to +35 LOC (just the `<details>` shell + 1 item in `COLLAPSIBLE_IDS`).

### 6.7 `vite.config.ts` admin path

The admin forms already POST to absolute paths (`/services`, `/clients`). The public endpoint `/gallery` is added to the proxy in PR 2. The admin paths (`POST /gallery`, `PATCH /gallery/{id}`, `DELETE /gallery/{id}`) hit the same proxy in dev — the existing proxy pattern is path-prefix based and `/gallery` matches all four methods.

In production, `api.ts` uses `VITE_API_URL` which is the Render backend URL. No additional config.

---

## 7. Brand shell (PR 4)

### 7.1 Status of binary assets and `index.html` (PR #54)

Confirmed at the current `origin/main` (`615cd76`):

- `frontend/public/logo.png` — 6,451 bytes, 64×64 px (proposal target was <30 KB; we are at 6.5 KB — well under).
- `frontend/public/favicon.ico` — 381 bytes, multi-res 16/32/48.
- `frontend/public/favicon-32x32.png` — 822 bytes.
- `frontend/public/apple-touch-icon.png` — 24,875 bytes, 180×180.
- `frontend/index.html` lines 8-10 — the 3 favicon links ALREADY wired.
- `frontend/src/App.tsx:113` — the `<img src="/logo.png" alt={businessName} width={36} height={36} className="navbar-brand-logo" />` ALREADY wired.

**Total `frontend/public/` binary size: ~32.5 KB (well under the 100 KB budget in the proposal).**

PR 4 inherits all of this. The proposal's "binary asset pipeline" work-units (1 and 2 in PR 4, lines 248-249 of `proposal.md`) are **already done** by PR #54. PR 4's work-units are reduced to 2: Navbar extraction + logo size bump.

### 7.2 Navbar extraction

Move `App.tsx:107-215` (the `<nav>`, the mobile drawer overlay, the mobile drawer) into a new file `frontend/src/components/layout/Navbar.tsx` (~150 LOC). The footer (`App.tsx:221-238`) and the FAB (`App.tsx:244-255`) stay in `App.tsx` — they are page-chrome but not navbar.

**What transfers as-is**:
- All `useState` / `useRef` / `useEffect` for `mobileOpen`, `isDesktop`, the focus-trap `useEffect` (`App.tsx:33-86`).
- The `whatsappUrl()` helper, the `useConfig` and `useAuth` reads.
- All `react-icons/fa` imports for the icons (`FaWhatsapp`, `FaInstagram`, `FaFacebook`, `FaAddressBook`, `FaBars`, `FaTimes`).
- The `isContactUrl` import.
- The `FOCUSABLE_SELECTOR` constant and the focus-trap body.

**What App.tsx keeps**:
- The `useEffect` for `document.title` (`App.tsx:33-35`) — sets the tab title from `businessName`. Stays in `App.tsx` because it's about the page, not the navbar.
- The `isDesktop` state — it's used by both the navbar (mobile drawer) and the FAB (visibility). Easiest path: leave `isDesktop` in `App.tsx`, pass it down as a prop to `Navbar` and to the FAB render. Net effect: +1 prop on `<Navbar isDesktop={isDesktop} />`, no new state.
- The footer, FAB, `<Outlet />`, `<SkipLink />`, `<ScrollToTop />`.

After extraction, `App.tsx` is ~155 LOC (down from 260, net −105). The `Navbar.tsx` file is ~150 LOC. The `class="navbar-brand-logo"` styling for the icon in the loading state (`App.tsx:95`) is also lifted: `Navbar.tsx` always renders the `<img src="/logo.png">` (or the ✦ glyph in the loading state), with a prop or branch.

**Decision: lift the loading-state glyph into Navbar.tsx as well.** Currently the loading branch (`App.tsx:88-105`) renders a separate skeleton navbar inline. The extracted `Navbar.tsx` will accept an `isLoading?: boolean` prop and render the skeleton internally. The `App.tsx` auth-loading branch (`App.tsx:88-105`) becomes 7 LOC:

```tsx
if (authLoading) {
  return (
    <div className="page-wrap">
      <SkipLink />
      <Navbar isLoading />
      <main className="page-main" id="main" tabIndex={-1}>
        <SkeletonLoader variant="card" className="max-w-2xl mx-auto mt-8" />
      </main>
    </div>
  )
}
```

This is a strict improvement: the loading state was duplicating navbar markup inline, which is exactly the kind of duplication the refactor removes.

### 7.3 Logo size bump (locked user feedback)

User prompt 2026-07-03 16:38:53: *"Podrias agrandarlo un poco mas al logo del navbar? Lo implementamos en la siguiente pr nomas tranqui, seguimos con el sdd home static"*. Translation: "Can you make the navbar logo a bit bigger? We'll do that in the next PR, no problem, let's keep going with the home-static SDD."

**Current size**: 36×36 px (`App.tsx:113`, `index.css:192`).

**Proposed new size**: **48×48 px** in `<img width={48} height={48}>` and `.navbar-brand-logo { width: 48px; height: 48px; }`.

Trade-off matrix:

| Size | Pros | Cons |
|---|---|---|
| 40×40 (modest) | Subtle bump, low CLS risk, fits 68px navbar height with breathing room. | Barely noticeable — user said "un poco mas" but the increment is small. |
| **48×48 (recommended)** | Visible bump, still fits comfortably in 68px navbar height (12px of padding top + bottom), no CLS risk, matches Material/iOS small-icon conventions. | Slightly larger touch target border (still < 50% of navbar). |
| 56×56 | Strongly visible bump, brand-forward. | Cramped in 68px navbar (6px padding top + bottom), pushes the `businessName` text to a smaller width, risks wrapping on mobile. |
| 64×64 | Maximum bump the proposal budget allowed (logo was originally 64×64 source). | Same as 56×56 but worse — the `businessName` text becomes secondary in the brand block. |

**Decision: 48×48.** The 36→48 jump is a 33% size increase (vs. 36→56 = 56% or 36→64 = 78%). The brand text and the icon coexist comfortably in the existing 68px navbar height with 10px top + 10px bottom padding remaining. Mobile (≤ 768px) navbar height is the same — verified by `index.css:189` `.navbar-inner { height: 68px; }` which is not media-queried.

**Implementation**: change one number in 4 places:
- `App.tsx:113` (pre-extraction) or `Navbar.tsx` (post-extraction): `width={48} height={48}`.
- `index.css:192`: `.navbar-brand-logo { width: 48px; height: 48px; ... }`.
- (The two react-icons references in the social row use fixed 22px and are not affected.)
- (The ✦ glyph in the loading state is a `<span>` and is centered by flex; the flex container now has `width: 48px; height: 48px` so the glyph scales with it — no code change needed.)

### 7.4 What PR 4 does NOT touch (locked)

- **Typography** (Playfair Display + Plus Jakarta Sans) — no font change.
- **Favicon assets** — already in `origin/main` via PR #54.
- **Page title strategy** — `App.tsx`'s `useEffect(() => { document.title = businessName }, [businessName])` is fine. The `<title>Nails Studio — Manicuría & Nail Design</title>` in `index.html` is the pre-hydration value; React overwrites it on mount. No change.
- **og:image** — explicitly out of scope (proposal §8 list, no item for it). The HTML head lacks `<meta property="og:image">` and we are not adding it in this change. Can be a follow-up.
- **Brand text in `<img alt>`** — `alt={businessName}` is correct (the alt text is the brand name, not "logo"). The image is a CSS-decorative-equivalent decoration for sighted users but a brand identifier for screen-reader users.

---

## 8. Open questions resolved

The 8 open questions from `proposal.md:333-342`. Each is resolved here (no new design questions are raised).

### 8.1 (Q1) What does `GET /gallery` return when no items are active?

**Resolution: return all 6 slots (active + inactive) with `activo` set per row.** The frontend filters and shows the empty-state message ("Galería sin imágenes activas por el momento", spec REQ-HGAL-001 / REQ-BKG-006).

Rationale: simpler than the alternatives, allows the admin UI to show "inactive" rows grayed out, and gives the frontend a single shape to consume. The cost is one extra round-trip filter on the client — trivial.

### 8.2 (Q2) What happens to inactive items in the admin UI?

**Resolution: all 6 always show, inactive grayed out with the `activo` toggle visible.** Matches spec REQ-HGAL-051 and the proposal recommendation. Inactive rows are rendered with `opacity: .5` and a "Inactivo" label (mirroring `ServicesSection.tsx:125-127`).

### 8.3 (Q3) Default `alt_text` when admin leaves blank?

**Resolution: Pydantic `min_length=1` rejects at the API layer (422). The admin UI also rejects client-side, disabling the "Guardar" button when `alt_text.trim() === ""`.** The error message in the form is "Alt text es obligatorio" (matches spec REQ-HGAL-051 scenario "alt_text vacío bloquea Guardar").

### 8.4 (Q4) `orden` is fixed 1..6 — admin wants fewer than 6?

**Resolution: leave unused slots inactive.** CSS Grid `repeat(auto-fill, minmax(280px, 1fr))` fills the row — 4 items show as 2×2, 3 as 1×3, etc. No special handling. Spec REQ-HGAL-051 supports this.

### 8.5 (Q5) Aspect ratio policy?

**Resolution: `aspect-ratio: 4 / 3` on `.gallery-item` with `object-fit: cover` on the `<img>`.** Admin UI hint says "Recomendado 4:3 o 1:1" (matches proposal §8.5). 4:3 matches the project's existing `.service-card` content ratio and the proposal's explicit recommendation.

### 8.6 (Q6) Gallery image preview in admin — debounced?

**Resolution: YES, 300ms `useEffect` debounce.** 60×60 thumbnail preview next to the `image_url` input. Worth the ~30 LOC — without it, the admin can't tell a typo'd URL from a working one until they reload the public Home. Matches proposal §8.6.

### 8.7 (Q7) FAQ single-open vs multi-open?

**Resolution: MULTI-OPEN (overrides the proposal's recommendation of single-open).** Locked in memory obs 2026-07-03 — user-signed-off during the proposal Q&A. Implementation: `useState<Set<number>>(new Set())` in `FaqSection.tsx`. Spec REQ-HSSC-040 codifies this.

### 8.8 (Q8) Testimonials source?

**Resolution: clearly mark as "Ejemplo" / "Testimonio" in the card so visitors know they're representative.** Spec REQ-HSSC-030: the studio has no public testimonials yet, so the initial copy is illustrative. Each card carries a subtle badge "Testimonio" in muted text (the card is still a quote, but the label removes any false-implication that the client left a real review). User can swap to real copy in a follow-up.

---

## 9. Process gates

### 9.1 Copy approval gate (orchestrator drafts, user reviews)

Three blocks of copy in PR 2 are user-voice-sensitive:
- **Sobre mí** (`AboutMeSection.tsx`) — 80-150 words, first-person, warm.
- **Testimonios** (`TestimonialsSection.tsx`) — 3 cards with name + quote.
- **FAQ** (`FaqSection.tsx`) — 4-5 Q&A pairs.

**Process**:
1. Apply phase commits placeholder copy first (3 separate commits, one per block, each marked with `// TODO(sdd): user voice review required` at the top of the const array).
2. Apply phase submits each block to the user for review.
3. User approves or rejects each block individually.
4. On approval: the orchestrator commits a follow-up that removes the `TODO` comment and any remaining placeholder text.
5. On rejection: the orchestrator rewrites and re-commits the same block (the file is the only change in the commit).

**Verify gate**: the verify phase reads the 3 files and fails `pass` if any of the `TODO` comments is still present. Status: `blocked` (matches spec REQ-HSSC-060).

**Isolation**: each of the 3 copy commits is independent and revertable. If the user rejects the FAQ copy, only that commit is reverted; the other 2 stand. Matches spec REQ-HSSC-061.

### 9.2 TDD gate (backend)

Strict TDD mode is ACTIVE for PR 1. Every endpoint is preceded by a failing pytest case.

**Test file structure**:

`backend/tests/test_gallery.py` (NEW, ~180 LOC). One `TestClass` per requirement cluster:

| Class | Tests | Covers |
|---|---|---|
| `TestGallerySeed` | `test_seed_creates_six_inactive_slots`, `test_seed_is_idempotent_on_populated_db`, `test_seed_does_not_overwrite_existing_data` | REQ-HGAL-001 (seed) |
| `TestGallerySchemas` | `test_create_rejects_orden_out_of_range`, `test_create_rejects_invalid_url`, `test_create_rejects_empty_alt_text`, `test_update_excludes_orden_field`, `test_update_partial_keeps_omitted_fields` | REQ-HGAL-002 (schemas) |
| `TestGalleryPublicGet` | `test_get_returns_empty_list_when_table_empty`, `test_get_returns_six_items_ordered_by_orden`, `test_get_does_not_require_auth`, `test_get_includes_inactive_items` | REQ-HGAL-010 (GET) |
| `TestGalleryAdminCreate` | `test_create_returns_201_with_payload`, `test_create_without_auth_returns_401`, `test_create_with_duplicate_active_orden_returns_409`, `test_create_with_inactive_duplicate_orden_succeeds` | REQ-HGAL-020 (POST) |
| `TestGalleryAdminPatch` | `test_patch_updates_only_provided_fields`, `test_patch_with_missing_id_returns_404`, `test_patch_without_auth_returns_401` | REQ-HGAL-021 (PATCH) |
| `TestGalleryAdminDelete` | `test_delete_returns_204`, `test_delete_with_missing_id_returns_404`, `test_deleted_slot_removed_from_get` | REQ-HGAL-022 (DELETE) |

Total: ~16-18 pytest cases, fits the proposal's ≥ 10 budget with margin for refactor-revealed edge cases.

**Test client**: use `TestClient` from `fastapi.testclient` (matching the existing `test_endpoints.py` pattern). Each test uses an in-memory SQLite engine via the `client` fixture from `conftest.py` to avoid touching the dev DB.

**Strict TDD loop per endpoint**:
1. RED: write the test class + 1-2 cases. Run `pytest backend/tests/test_gallery.py::TestGalleryPublicGet -v`. Confirm it fails with the expected error (404 because endpoint doesn't exist yet, or 500 because model isn't imported).
2. GREEN: write the endpoint stub, the schema, the model. Run the same `pytest` command. Confirm green.
3. REFACTOR: extract the orden-uniqueness check into a helper if it's used in both POST and PATCH; clean up. Re-run.

**Vertical slicing, NOT horizontal**: the test file is NOT written front-to-back (all model tests, then all schema tests, then all endpoint tests). Instead, each work-unit commit in PR 1 covers one vertical slice:
- Commit 2 (schemas) RED→GREEN: `TestGallerySchemas` for `Create` rejects bad data.
- Commit 3 (GET) RED→GREEN: `TestGalleryPublicGet` returns 200 with 6 items.
- Commit 4 (POST) RED→GREEN: `TestGalleryAdminCreate` returns 201, 401, 409.
- Commit 5 (PATCH + DELETE) RED→GREEN: `TestGalleryAdminPatch` + `TestGalleryAdminDelete`.

---

## 10. PR breakdown

Total: ~1,465 LOC + ~33 KB binary (binary not counted toward the 400-line budget). The proposal's LOC estimates stand; PR 4 is reduced because the binary assets are inherited from PR #54.

### 10.1 PR 1 — Backend: `GalleryItem` + endpoints + tests

- **Files touched** (5 + 1 new):
  - `backend/app/models.py` (+15) — append `GalleryItem` class.
  - `backend/app/schemas.py` (+55) — append 4 Pydantic schemas.
  - `backend/app/main.py` (+130) — `seed_default_gallery` (+12), register in lifespan (+1), 4 endpoints (+110), `GalleryItem` import (+1), 4 schema imports (+4), `_check_orden_conflict` helper (+2 net from import).
  - `backend/app/database.py` (+3) — one-line comment documenting the `create_all` contract.
  - `ARCHITECTURE.md` (+5) — `Galería` aggregate line.
  - `backend/tests/test_gallery.py` (NEW, +180) — 16-18 pytest cases.
- **LOC estimate**: ~390 (within budget).
- **Depends on**: nothing.
- **Work-unit commits** (6 total, each ≤ 150 LOC, TDD red-green-refactor):
  1. `chore(sdd): add GalleryItem SQLModel + ARCHITECTURE.md entry` (+~30 LOC; no test — model is exercised by the endpoint tests).
  2. `feat(sdd): add gallery Pydantic schemas (RED → GREEN)` (+~80 LOC; 4 schemas + 5 schema-only tests in `TestGallerySchemas`).
  3. `feat(sdd): GET /gallery public endpoint + tests` (+~90 LOC; endpoint + 4 tests in `TestGalleryPublicGet`).
  4. `feat(sdd): POST /gallery admin endpoint + tests` (+~70 LOC; endpoint + 4 tests in `TestGalleryAdminCreate`).
  5. `feat(sdd): PATCH + DELETE /gallery admin endpoints + tests` (+~80 LOC; 2 endpoints + 6 tests in `TestGalleryAdminPatch` + `TestGalleryAdminDelete`).
  6. `chore(sdd): seed_default_gallery in lifespan` (+~40 LOC; seed fn + lifespan list + 3 tests in `TestGallerySeed`).
- **Acceptance criteria**:
  - `python -m pytest backend/tests/test_gallery.py -v` is green (16+ tests pass).
  - `python -m pytest` (full suite) is green — no regressions in the existing 182 tests.
  - `GET /gallery` returns 200 with up to 6 items ordered by `orden`, no auth required.
  - `POST /gallery` requires auth (401 without token), validates URL format (422), rejects `orden` outside 1..6 (422), rejects duplicate `orden` against an active row (409).
  - `PATCH /gallery/{id}` does partial update, returns 404 on missing id.
  - `DELETE /gallery/{id}` returns 204.
  - `seed_default_gallery` is idempotent (re-running on a populated DB inserts 0 rows).
- **Verification gate**: `python -m pytest backend/tests/test_gallery.py -v` AND `python -m pytest`. Both green.
- **Parallelism**: can run in parallel with PR 4 (disjoint files).

### 10.2 PR 2 — Public frontend: 5 new sections + Home rewire + docs

- **Files touched** (10):
  - `frontend/src/components/public/GallerySection.tsx` (NEW, +95).
  - `frontend/src/components/public/Lightbox.tsx` (NEW, +50).
  - `frontend/src/components/public/AboutMeSection.tsx` (NEW, +35).
  - `frontend/src/components/public/HowToBookSection.tsx` (NEW, +55).
  - `frontend/src/components/public/TestimonialsSection.tsx` (NEW, +60).
  - `frontend/src/components/public/FaqSection.tsx` (NEW, +80).
  - `frontend/src/hooks/useGallery.ts` (NEW, +50).
  - `frontend/src/hooks/index.ts` (+1) — re-export `useGallery`.
  - `frontend/src/api.ts` (+~40) — `GalleryItemRead` type + `getGallery` function.
  - `frontend/src/pages/Home.tsx` (+60 net) — 5 imports + 5 JSX lines + `useGallery` call.
  - `frontend/src/index.css` (+130) — gallery-grid, gallery-item, gallery-empty, faq-item, faq-question, faq-chevron, faq-panel, testimonials-grid, testimonial-card, testimonial-quote, testimonial-name, how-to-book-steps, lightbox-backdrop, lightbox-content, lightbox-image, lightbox-close (+ 4 LOC reduced-motion belt-and-suspenders).
  - `frontend/vite.config.ts` (+1) — `'/gallery': 'http://localhost:8000'`.
  - `REQUIREMENTS.md` (+25) — §2.A.4 Carrusel→Grid + 4 new sections.
  - `ARCHITECTURE.md` (+3) — `home-static-content` line.
  - `DOCUMENTATION.md` (+10) — phase-completion changelog.
- **LOC estimate**: ~680 (over budget — `size:exception` pre-approved by user; locked in memory obs 2026-07-03).
- **Depends on**: PR 1 (needs the `/gallery` endpoint to type-check against).
- **Work-unit commits** (7 total, each ≤ 150 LOC):
  1. `chore(sdd): add useGallery hook + api.ts gallery helpers` (+~90 LOC).
  2. `feat(sdd): GallerySection + Lightbox + index.css grid` (+~200 LOC; component + lightbox + CSS — this is the largest commit, but it is the work-unit that delivers the core feature, so it ships as one reviewable chunk).
  3. `feat(sdd): extend Home.tsx from 5 to 10 sections` (+~60 LOC; reorder, add 5 new sections, no copy yet — placeholders).
  4. `feat(sdd): AboutMeSection copy + wiring` (+~35 LOC).
  5. `feat(sdd): HowToBookSection steps + wiring` (+~55 LOC).
  6. `feat(sdd): TestimonialsSection + FaqSection` (+~140 LOC combined).
  7. `docs(sdd): sync REQUIREMENTS.md §2.A.4 Carrusel→Grid + new sections` (+~25 LOC, plus ARCHITECTURE.md, plus DOCUMENTATION.md).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Home renders all 10 sections in the locked order: Hero → Servicios → Galería → Sobre mí → Cómo reservar → Testimonios → FAQ → Conectemos → CTA → Ubicación.
  - With 0 active gallery items, the Galería section shows the empty state "Galería sin imágenes activas por el momento".
  - With 6 active items, the grid shows 6 images with `loading="lazy"`, no CLS (Lighthouse CLS < 0.1 on a manual desktop run).
  - Clicking an image with `link_url` opens it in a new tab with `rel="noopener noreferrer"`.
  - Clicking an image without `link_url` opens the lightbox. Escape closes. Tab is trapped. Body scroll is locked while open. Focus returns to the thumbnail on close.
  - `REQUIREMENTS.md:41` reads "Sección de Trabajos Realizados (Grid de 6)" — the word "Carrusel" no longer appears in the gallery section.
  - Sobre mí has 2-3 paragraphs, 80-150 words total, first-person warm tone.
  - FAQ is multi-open: clicking one question does not close the others.
  - Sobre mí, Testimonios, FAQ copy approved by the user (process gate).
- **Verification gate**: `npx tsc --noEmit` + Lighthouse desktop smoke (CLS < 0.1, LCP < 2.5s) + manual screen-reader pass (VoiceOver or NVDA) on the lightbox + user voice review of the 3 copy blocks.
- **Parallelism**: sequential after PR 1; can run in parallel with PR 3 once PR 1 lands.

### 10.3 PR 3 — Admin frontend: `GallerySection` + hook + Admin wiring

- **Files touched** (4):
  - `frontend/src/components/admin/GallerySection.tsx` (NEW, +200).
  - `frontend/src/hooks/useGallery.ts` (+30) — 3 mutations: `useCreateGalleryItem`, `useUpdateGalleryItem`, `useDeleteGalleryItem`.
  - `frontend/src/hooks/index.ts` (+3) — re-export the 3 mutations.
  - `frontend/src/api.ts` (+~20) — `GalleryItemCreate`, `GalleryItemUpdate` types + 3 functions.
  - `frontend/src/pages/Admin.tsx` (+35) — `'galeria'` in `COLLAPSIBLE_IDS` (1 LOC) + new `<details>` block (~34 LOC).
  - `DOCUMENTATION.md` (+5) — phase-completion changelog.
- **LOC estimate**: ~290 (within budget).
- **Depends on**: PR 1 (needs the POST/PATCH/DELETE endpoints).
- **Work-unit commits** (3 total):
  1. `chore(sdd): add admin gallery API helpers + useAdminGallery hook` (+~50 LOC).
  2. `feat(sdd): GallerySection admin component (create/edit/delete + image preview)` (+~200 LOC; the DataTable-free variant, vertical list with 6 slot editors).
  3. `feat(sdd): wire GallerySection into Admin.tsx collapsible` (+~35 LOC).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Admin can see the 6 pre-seeded inactive slots in a list.
  - Admin can edit a slot: paste image URL → see thumbnail preview within 500 ms (300 ms debounce + paint time); type alt text; optionally paste link URL; toggle active; click "Guardar" → 200 from the backend, list refreshes.
  - Admin can delete a slot → 204, row disappears, the `orden` slot becomes free.
  - Empty alt text is rejected client-side before the request fires.
  - "+ Nuevo slot" button calls `POST /gallery` with the next free `orden`. Disabled when 6 slots exist.
  - The new collapsible opens by default on first visit (matches the existing `false` default for new IDs at `Admin.tsx:64`) and persists in `localStorage` like the other collapsibles.
- **Verification gate**: `npx tsc --noEmit` + manual smoke (login as admin, edit 2 slots, verify they show on the public Home after page reload).
- **Parallelism**: can run in parallel with PR 2 once PR 1 lands.

### 10.4 PR 4 — Brand shell: Navbar extraction + logo size bump

- **Files touched** (3 source + 0 binary, because PR #54 already shipped the binary):
  - `frontend/src/components/layout/Navbar.tsx` (NEW, +150).
  - `frontend/src/App.tsx` (-105 net) — replace inline block with `<Navbar isDesktop={isDesktop} />` import; lift `isDesktop` state to stay in `App.tsx` since the FAB also needs it.
  - `frontend/src/index.css` (+0 net) — change `.navbar-brand-logo { width: 36px; height: 36px; }` to `width: 48px; height: 48px` (2 number changes in 1 rule, +0 LOC).
  - `DOCUMENTATION.md` (+5) — phase-completion changelog.
- **LOC estimate**: ~55 source LOC (the binary assets are inherited from PR #54 and not re-emitted; well under the 400-line budget).
- **Depends on**: nothing — disjoint from PR 1's files. Can land in parallel with PR 1.
- **Work-unit commits** (2 total):
  1. `feat(sdd): extract Navbar.tsx from App.tsx` (+150 Navbar, -105 App; net +45 source LOC; the refactor is purely structural — visual output identical apart from the logo size).
  2. `chore(sdd): bump logo size from 36×36 to 48×48` (2 number changes in `App.tsx` / `Navbar.tsx` + 1 CSS rule; +~3 LOC).
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Navbar renders identically to before the refactor (no visual regression) APART from the logo size — the logo is visibly larger.
  - The `<img src="/logo.png" alt={businessName} width={48} height={48}>` is correctly rendered.
  - Mobile drawer focus trap still works (Escape closes, Tab cycles inside).
  - The auth-loading skeleton navbar (in `App.tsx`'s `if (authLoading)` branch) renders via `<Navbar isLoading />` and is visually identical to the pre-refactor state.
  - Lighthouse "Properly defines `<link rel="icon">`" check still passes (inherited from PR #54, no change).
  - `frontend/public/` binary size is unchanged (~32.5 KB, well under the 100 KB budget).
- **Verification gate**: `npx tsc --noEmit` + visual smoke (navbar looks the same except the logo is larger) + manual mobile drawer a11y test (Tab cycles, Escape closes).
- **Parallelism**: can run in parallel with PR 1 (disjoint file sets).

### 10.5 Total LOC by PR

| PR | Source LOC | Binary | Files touched | Budget |
|---|---|---|---|---|
| 1 — Backend | ~390 | 0 | 6 | within |
| 2 — Public FE | ~680 | 0 | 14 | **over (`size:exception` pre-approved)** |
| 3 — Admin FE | ~290 | 0 | 6 | within |
| 4 — Brand shell | ~55 | 0 | 3 | within (PR #54 emitted the binary) |
| **Total** | **~1415** | 0 (inherited) | 29 | 1 over-budget PR (locked) |

---

## 11. Risks

The 11 risks from the proposal (numbered 1-11 below). Each row confirms whether the design mitigation matches the proposal mitigation, plus 2 new risks the design uncovers (R12, R13).

| # | Risk | Severity (design) | Mitigation in this design |
|---|---|---|---|
| 1 | **PR 2 overshoots the 400-LOC review budget by ~70%** | High (locked) | The 7 work-unit commits in PR 2 are each ≤ 200 LOC (one is exactly 200). A reviewer can stop between any two. The `size:exception` is pre-approved. |
| 2 | **`REQUIREMENTS.md:41` sync drift** (the §2.A.4 change might be missed if PR 2 lands before the docs commit) | Medium | Work-unit 7 in PR 2 is the docs commit; it MUST land last. Verify phase rechecks the spec text against the rendered Home. |
| 3 | **Brand-voice drift on orchestrator-drafted copy** | Medium | The user MUST review and approve the 3 copy blocks before verify passes (process gate locked in §9.1). Copy lives in 3 separate commits, each revertable independently. |
| 4 | **External image hotlink fragility** | Medium | `<img onError>` falls back to a placeholder block with "Imagen no disponible" in italic (spec REQ-HGAL-060). Admin UI shows a hint: "Usá URLs que no roten — tu propio CDN, Cloudinary, Imgur links directos." No automated link checker in v1. |
| 5 | **CLS on unoptimized images** | Medium | Mandatory `width={384}` + `height={288}` attributes in the rendered markup (4/3 aspect ratio of the `.gallery-item` cell). `loading="lazy"`, `decoding="async"`. Admin UI hint recommends pre-sizing to 1200×800. |
| 6 | **Lightbox a11y regression** | Low | Mirror the existing focus-trap pattern from `App.tsx:52-86` (proven correct). Verify phase runs a manual screen-reader pass. |
| 7 | **Migration ordering race** | Very Low | `SQLModel.metadata.create_all` runs BEFORE `run_migration` in the lifespan. New table materializes on first startup automatically. Documented in §2.2. |
| 8 | **Copy approval gate blocks verify indefinitely** | Low | The 3 copy commits in PR 2 are isolated and revertable. If the user can't review in time, PR 2 can land with the placeholders; the copy updates land in a follow-up commit. |
| 9 | **Logo size bump destroys visual balance** | Low (now very low) | 48×48 fits comfortably in the 68px navbar height with 10px top + bottom padding. Visual smoke in the verify gate. 56 and 64 rejected (see §7.3 trade-off matrix). |
| 10 | **Admin pastes a `link_url` and forgets `target="_blank"` semantics** | Very Low | `<a target="_blank" rel="noopener noreferrer">` is hardcoded in `GallerySection.tsx` — not a per-item field. No way to misconfigure. |
| 11 | **Public-booking precedent gotcha — `response.status_code` override** | N/A (not relevant) | `GET /gallery` is read-only and always returns 200. Noted for awareness only. |
| **12 (new)** | **`HttpUrl` trailing-slash wire-format quirk** (Pydantic v2 appends `/` to bare-hostnames on read) | Low | The model column is `str` (not `HttpUrl`). `HttpUrl` is only on the wire for `Create`/`Update`. Stored value is the admin's raw input. On read, `GalleryItemRead.image_url: str` returns the stored string. No transformation. **Verification step**: admin pastes `https://example.com`, the DB stores `https://example.com` (no trailing slash), the public read returns `https://example.com` (no trailing slash). |
| **13 (new)** | **Active-only partial unique index not portable to SQLite** | Low | The route does an explicit `SELECT * FROM galleryitem WHERE orden = :orden AND activo = true AND id != :exclude_id` and returns 409 if any match. This is uglier than a `CREATE UNIQUE INDEX ... WHERE activo` (PostgreSQL native), but it works on both SQLite and PostgreSQL. The DB column is `int` with no DB-level unique constraint. Documented in §3.5. |
| **14 (new)** | **Auth-loading skeleton navbar duplication** | Very Low | PR 4's Navbar extraction lifts the loading state (`App.tsx:88-105`) into `Navbar.tsx` as an `isLoading` prop. The 18-line inline skeleton is replaced by a 7-line call. Strict improvement — no duplication risk. |

---

## 12. Rollback

Per-PR rollback is unchanged from the proposal. Confirming and refining:

- **PR 1**: additive only. The new `galleryitem` table is created by `create_all`; reverting PR 1 drops the new file (no data lost because no other PR or migration depends on the table). If a future migration ever adds `ALTER TABLE galleryitem`, the revert removes the migration call but the table persists (orphaned, no harm).
- **PR 2**: reverts the Home to the 5-section layout. The 6 new components and 16 new CSS classes are unused but harmless. `REQUIREMENTS.md` rolls back to "Carrusel".
- **PR 3**: reverts the admin `<details>` collapsible. The `GallerySection` component and its 3 mutations are unused but harmless.
- **PR 4**: reverts to inline `App.tsx` navbar with the 36×36 logo. The 48×48 size change is one line. The extracted `Navbar.tsx` file is deleted. Binary assets in `frontend/public/` stay (PR #54 emitted them — they don't depend on this PR).
- **Tracker branch `feat/home-static-sections` is the rollback point**: if everything goes wrong, abandon the tracker and `main` is unaffected. `origin/main` already has the brand-shell hotfix from PR #54 — the project never loses the favicons or the navbar logo image.

---

## 13. Chain strategy recommendation

The proposal says "4 chained PRs against tracker `feat/home-static-sections` from `origin/main`". Two chain strategies are valid per the `chained-pr` skill:

### 13.1 Option A: Stacked to main (each PR merges to main in order)

```
PR 1 → main
PR 2 → main (waits for PR 1)
PR 3 → main (waits for PR 1; can run with PR 2)
PR 4 → main (independent, can land anytime)
```

Pros: every PR is immediately reviewable on main; no long-lived integration branch; the integration risk is paid per-PR not in one big-bang.

Cons: 4 separate PRs against main is 4 separate CI runs and 4 separate review cycles. If PR 2 (the over-budget one) is rejected and needs a rebase, PR 3 is stuck waiting on it (despite being independent at the file level).

### 13.2 Option B: Feature branch chain (each PR targets the previous PR's branch)

```
PR 1 → feat/home-static-sections (tracker)
PR 2 → feat/home-static-sections-gallery-section
PR 3 → feat/home-static-sections-admin-gallery
PR 4 → feat/home-static-sections-brand-shell
        ↓ (rebases onto main as it lands)
tracker → main
```

Pros: each PR's diff is clean (only the current work unit); the tracker PR accumulates the diffs; if PR 2 is rejected, only PR 2 needs a rebase (PR 3 re-rebases onto the fixed PR 2).

Cons: 4 child branches to maintain; rebase dance if PRs 2 and 3 race; more cognitive overhead for the user.

### 13.3 Recommendation: **Stacked to main (Option A)**

Rationale:
1. **The 4 PRs are genuinely independent in their file sets** (PR 1 = backend; PR 2 = public FE; PR 3 = admin FE; PR 4 = brand shell). PR 4 and PR 1 can land in either order. PR 2 and PR 3 only depend on PR 1, not on each other. There is no integration risk that a tracker would absorb.
2. **No cross-PR refactor.** None of the 4 PRs touch the same file. PR 1 doesn't import from PR 2's hooks. PR 2 doesn't import from PR 3's `GallerySection`. The deps are at the API contract level (PR 2 needs the `/gallery` endpoint; PR 3 needs the CRUD endpoints), and PR 1 is the only contract-defining PR.
3. **Each PR is reviewable on its own.** A reviewer who only cares about the backend can review PR 1 and ignore the others. A reviewer who only cares about the admin can review PR 3 (after PR 1 lands). The tracker pattern adds noise without value.
4. **Simpler mental model.** Stacked to main = "4 features shipping in 4 PRs, in order". Feature branch chain = "4 features in a chain, plus a tracker that doesn't merge until all 4 are approved". For a project of this size and a team of 1, the simpler model wins.
5. **The one over-budget PR (PR 2) is mitigated by its work-unit commits**, not by the chain strategy. A reviewer can stop between any two of the 7 work-units in PR 2. That's a work-unit-commits mitigation, not a chain-strategy mitigation.

**Action for the user**: the design phase recommends `stacked-to-main`. The orchestrator should ask the user to confirm before `sdd-tasks` runs (this is the only open question in §14).

---

## 14. Open questions for tasks phase

Two minor items the design phase surfaced but does NOT block on. They are decisions for `sdd-tasks` or `sdd-apply`, not for the user.

1. **Number of pytest cases in `test_gallery.py`**: the proposal says "≥ 10", the design estimates 16-18. The exact count is set in `sdd-tasks` (a test case is added per behavior surfaced during TDD RED→GREEN cycles, not pre-planned). 16 is the target floor.
2. **Testimonials card name initials**: the design leaves the choice of name-initial avatar to the apply phase (e.g., "ML" for "María L." in a 36×36 round badge, matching `.navbar-brand-logo`'s gradient). If the user wants full-avatar images instead, the spec REQ-HSSC-030 allows it — but the orchestrator should default to initials to avoid 3 more image URLs the admin would have to manage.

No other design-level questions are open. The 8 proposal questions (§8) are all resolved in this design.

---

## Appendix A — Locked decisions (do not relitigate in tasks/apply)

| # | Decision | Source |
|---|---|---|
| D1 | FAQ is **multi-open** (overrides proposal rec) | Memory obs 2026-07-03; spec REQ-HSSC-040 |
| D2 | Branch strategy: 4 chained PRs against tracker `feat/home-static-sections` from `origin/main` (`615cd76`) | Proposal §PR Breakdown |
| D3 | PR 2 carries `size:exception` (pre-approved by user) | Memory obs 2026-07-03 |
| D4 | PR 4 inherits binary assets from PR #54 (logo.png, favicon.ico, favicon-32x32.png, apple-touch-icon.png all in origin/main) | Confirmed at `615cd76` |
| D5 | No carousel pattern (WCAG 2.2.2 — moving content without user control) | Proposal §Out of Scope; spec REQ-BKG-006 |
| D6 | No admin file upload — admin pastes external URLs | Proposal §Out of Scope; spec REQ-HGAL-051 |
| D7 | No anchor nav / smooth-scroll to sections | Proposal §Out of Scope |
| D8 | No brand fonts — keep existing Playfair Display + Plus Jakarta Sans | Proposal §Out of Scope |
| D9 | No `--muted` / `--border` token system refactor in this change | Proposal §Out of Scope |
| D10 | Logo size bump: 36→48 px (locked by user prompt 2026-07-03 16:38:53) | §7.3 of this design |
| D11 | Aspect ratio: 4/3 with `object-fit: cover` (locked) | Proposal §8.5 |
| D12 | Image preview debounce: 300 ms (locked) | Proposal §8.6 |
| D13 | Testimonials marked as "Ejemplo" / "Testimonio" badge (locked) | Proposal §8.8; spec REQ-HSSC-030 |
| D14 | Copy approval gate: 3 separate commits, each revertable | Proposal §Process gate; spec REQ-HSSC-060, 061 |
| D15 | Strict TDD for backend: vertical slices per endpoint, RED→GREEN→REFACTOR | Proposal; §9.2 of this design |
| D16 | PRs 2 and 3 depend on PR 1; PR 4 is independent (parallel with PR 1) | Proposal §Parallelism |
| D17 | Chain strategy: `stacked-to-main` (recommended in §13) | §13.3 of this design; needs user confirmation |

## Appendix B — Verification commands (per PR)

| PR | Backend | Frontend | Manual |
|---|---|---|---|
| 1 | `python -m pytest backend/tests/test_gallery.py -v` && `python -m pytest` | n/a | `curl http://localhost:8000/gallery` returns 6 items after `seed_default_gallery` runs |
| 2 | n/a | `npx tsc --noEmit` | Lighthouse desktop (CLS < 0.1, LCP < 2.5s); screen reader on lightbox; user approves copy |
| 3 | n/a | `npx tsc --noEmit` | Login as admin, edit 2 slots, reload public Home, verify changes |
| 4 | n/a | `npx tsc --noEmit` | Visual smoke (logo is bigger); mobile drawer a11y (Tab cycles, Escape closes) |

## Appendix C — File-level scope summary (alphabetical)

| File | Action | PR | LOC delta |
|---|---|---|---|
| `ARCHITECTURE.md` | Modify | 1, 2 | +8 |
| `backend/app/database.py` | Modify | 1 | +3 |
| `backend/app/main.py` | Modify | 1 | +130 |
| `backend/app/models.py` | Modify | 1 | +15 |
| `backend/app/schemas.py` | Modify | 1 | +55 |
| `backend/tests/test_gallery.py` | New | 1 | +180 |
| `DOCUMENTATION.md` | Modify | 1, 2, 3, 4 | +25 |
| `frontend/src/api.ts` | Modify | 2, 3 | +60 |
| `frontend/src/App.tsx` | Modify | 4 | -105 |
| `frontend/src/components/admin/GallerySection.tsx` | New | 3 | +200 |
| `frontend/src/components/layout/Navbar.tsx` | New | 4 | +150 |
| `frontend/src/components/public/AboutMeSection.tsx` | New | 2 | +35 |
| `frontend/src/components/public/FaqSection.tsx` | New | 2 | +80 |
| `frontend/src/components/public/GallerySection.tsx` | New | 2 | +95 |
| `frontend/src/components/public/HowToBookSection.tsx` | New | 2 | +55 |
| `frontend/src/components/public/Lightbox.tsx` | New | 2 | +50 |
| `frontend/src/components/public/TestimonialsSection.tsx` | New | 2 | +60 |
| `frontend/src/hooks/index.ts` | Modify | 2, 3 | +4 |
| `frontend/src/hooks/useGallery.ts` | New | 2, 3 | +80 |
| `frontend/src/index.css` | Modify | 2, 4 | +130 (+ 0 net for PR 4: 1 rule change) |
| `frontend/src/pages/Admin.tsx` | Modify | 3 | +35 |
| `frontend/src/pages/Home.tsx` | Modify | 2 | +60 |
| `frontend/vite.config.ts` | Modify | 2 | +1 |
| `REQUIREMENTS.md` | Modify | 2 | +25 |
| **Total source LOC** | | | **~1415** |
| `frontend/public/*.png` and `.ico` | (inherited from PR #54) | 4 | 0 |
