# Proposal: `gallery-upload`

## Intent

The gallery currently requires admin to paste external image URLs (CDN, Instagram, etc.), which is fragile (hotlink rotation), confusing (no preview until save), and UX-poor (no crop/resize, unclear error handling). There's also a critical bug: admin mutations pass `orden` (1-6) as the `id` parameter to PATCH/DELETE endpoints, but the backend expects the auto-increment DB `id` — after delete+recreate, `id !== orden` and operations fail with 404. This change adds direct file upload to Supabase Storage (browser→Supabase, stateless backend), fixes the `orden` vs `id` bug, and improves the gallery admin UI/UX throughout.

## Scope

### In Scope
- **Supabase Storage setup**: `gallery-images` bucket, RLS policies, env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- **Frontend upload**: Direct browser→Supabase Storage upload (no backend proxy), dual mode (paste URL OR upload file)
- **Crop/resize UI**: Client-side image preprocessing before upload (crop to 4:3, max 1200px wide)
- **Format validation**: JPG, PNG, WebP, GIF accepted; others rejected with clear message
- **Bug fix**: All admin mutations (`handleSaveSlot`, `handleToggleActive`, `handleDeleteSlot`) pass DB `id` instead of `orden`
- **Error handling**: Upload failures, storage quota, network errors, invalid files — all surfaced inline
- **UI/UX improvements**: Clearer slot layout, better preview, inline validation, upload progress indicator

### Out of Scope
- Backend upload proxy or signed-URL endpoint (browser talks to Supabase directly)
- Image optimization pipeline (sharp, CDN transforms) — admin pre-sizes
- Drag-and-drop reorder (orden stays fixed 1..6)
- Multiple file selection / batch upload
- Video or non-image media
- Admin-editable copy for gallery captions (separate change)

## Capabilities

### New Capabilities
- `gallery-upload`: Client-side file upload to Supabase Storage with crop/resize, format validation, and dual-mode (URL paste + file upload) admin UI.

### Modified Capabilities
- `home-gallery`: Admin mutations fixed to use DB `id` instead of `orden`; UI/UX improvements to slot editors; error handling added throughout.

## User Flow

### Admin upload flow
1. Opens "Galería de Trabajos" collapsible in `/admin`.
2. For each slot (1-6): sees two tabs/options — "Pegar URL" (existing) or "Subir imagen" (new).
3. **Upload path**: clicks "Subir imagen" → file picker opens (accepts JPG/PNG/WebP/GIF) → selects file → crop/resize modal appears (4:3 aspect, drag to position) → confirms → upload progress bar → Supabase Storage → `image_url` set to storage public URL → preview thumbnail shows.
4. **URL path**: unchanged — paste URL, debounced preview.
5. Fills `alt_text` (required), optional `link_url`, toggles `activo`, clicks "Guardar" → PATCH uses DB `id` (not `orden`).
6. Delete uses DB `id` → 204, slot removed.

### Public display flow
Unchanged — `GET /gallery` returns items, grid renders, lightbox on click. Only the `image_url` source changes (now potentially Supabase Storage URLs instead of external CDN URLs).

## Technical Approach

### Supabase Storage setup
- **Bucket**: `gallery-images` (public read, authenticated write via RLS)
- **RLS policy**: `INSERT/UPDATE/DELETE` where `auth.uid() IS NOT NULL`; `SELECT` for everyone
- **Env vars**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend only — backend stays stateless)
- **Path convention**: `gallery/{slot-orden}/{timestamp}-{filename}`

### Frontend upload (new `ImageUpload.tsx` component)
- `@supabase/supabase-js` client initialized in `frontend/src/lib/supabase.ts`
- File input with `accept="image/jpeg,image/png,image/webp,image/gif"`
- Client-side validation: file type, file size (≤5MB)
- Crop/resize modal: canvas-based, 4:3 aspect ratio, max 1200px width
- Upload via `supabase.storage.from('gallery-images').upload(path, file)`
- On success: extract public URL, set as `image_url` in slot state

### Backend changes (minimal)
- **None for upload** — Supabase Storage handles it directly from browser
- **Optional**: Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` env vars for future server-side operations (not used in this PR)
- **Bug fix is frontend-only** — mutations already call correct endpoints, just pass wrong `id`

### Bug fix: `orden` vs `id`
Current broken code (lines 126, 138, 149 of `GallerySection.tsx`):
```ts
// BROKEN: passes orden (1-6) as id
updateGalleryMutation.mutate({ id: orden, payload: ... })
deleteGalleryMutation.mutate(orden)
```
Fix: mutations must receive the DB `id` from `GalleryItemRead`, not `orden`. The `gallery` array already contains `id` per item — look up `id` by `orden` before calling mutations.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/lib/supabase.ts` | New | Supabase client init |
| `frontend/src/components/admin/ImageUpload.tsx` | New | Upload + crop/resize component |
| `frontend/src/components/admin/GallerySection.tsx` | Modified | Bug fix (orden→id), upload integration, UI/UX improvements |
| `frontend/src/hooks/useGallery.ts` | Modified | No changes needed (mutations already accept `id`) |
| `frontend/src/api.ts` | Modified | No changes needed (types already correct) |
| `frontend/package.json` | Modified | Add `@supabase/supabase-js` |
| `.env.example` | Modified | Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Supabase Storage RLS misconfiguration exposes bucket | Low | Follow Supabase docs exactly; test with unauthenticated curl before frontend integration |
| Crop/resize canvas API has browser inconsistencies | Medium | Use tested library (`react-image-crop` or similar) instead of raw canvas |
| Upload fails silently (no error surfaced) | Medium | Explicit error handling on every supabase call; inline error messages |
| File size exceeds Supabase free tier limits | Low | 5MB cap enforced client-side; Supabase free tier allows 1GB storage |
| Existing external URLs break if admin switches to upload | None | Dual mode — both URL and upload coexist; existing URLs untouched |

## Rollback

- **Single PR**: `git revert <merge-sha>` restores the pre-upload state
- **Supabase bucket**: can be deleted manually via Supabase dashboard (no data dependency)
- **Env vars**: remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env`
- **Package**: remove `@supabase/supabase-js` from `package.json`

## Success Criteria

- [ ] Admin can upload JPG/PNG/WebP/GIF via file picker → crop/resize → Supabase Storage → slot shows uploaded image
- [ ] Admin can still paste external URL (dual mode works)
- [ ] Delete and save mutations use DB `id` (not `orden`) — no 404 after delete+recreate
- [ ] Crop/resize modal shows 4:3 aspect with drag-to-position
- [ ] File size >5MB or invalid format shows clear inline error
- [ ] Upload progress is visible (progress bar or spinner)
- [ ] `npx tsc --noEmit` clean
- [ ] Public gallery renders uploaded images correctly
- [ ] All existing gallery functionality preserved (no regressions)
