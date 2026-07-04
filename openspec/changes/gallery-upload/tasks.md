# Tasks: gallery-upload

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 400–550 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (infra + bug fix) → PR 2 (ImageUpload) → PR 3 (integration + UI) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Supabase infra + bug fix + env setup | PR 1 | Foundation — no UI risk, quick review |
| 2 | ImageUpload component with crop/resize | PR 2 | Self-contained, large but isolated |
| 3 | GallerySection integration + UI/UX | PR 3 | Wires everything, depends on W1+W2 |

## Phase 1: Infrastructure & Setup

- [x] 1.1 Install `@supabase/supabase-js` in `frontend/` — `npm install @supabase/supabase-js`
- [x] 1.2 Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `frontend/.env.example`
- [x] 1.3 Create `frontend/src/lib/supabase.ts` — client init reading VITE env vars (design §Supabase Client Init)
- [x] 1.4 Verify: `tsc --noEmit` passes with new file

## Phase 2: Bug Fix — orden vs id

- [x] 2.1 In `frontend/src/components/admin/GallerySection.tsx`, fix `handleSaveSlot` to resolve `id` from `gallery.find(item => item.orden === orden)?.id` instead of passing `orden` as `id` (REQ-HGAL-074, design §Bug Fix)
- [x] 2.2 Fix `handleDeleteSlot` — same pattern: resolve DB `id` from `orden` before calling `deleteGalleryMutation.mutate(id)`
- [x] 2.3 Fix `handleToggleActive` — same pattern: resolve DB `id` before calling `updateGalleryMutation.mutate({ id: itemId, payload: { activo: ... } })`
- [x] 2.4 Verify: `tsc --noEmit` passes after bug fix

## Phase 3: ImageUpload Component

- [x] 3.1 Create `frontend/src/components/admin/ImageUpload.tsx` — file picker accepting JPG, PNG, WebP, GIF with 5MB client-side validation (REQ-HGAL-070)
- [x] 3.2 Add crop/resize modal: canvas-based, aspect ratio toggle 4:3 / 1:1, zoom in/out, pan controls (REQ-HGAL-071)
- [x] 3.3 Implement compression pipeline: canvas export to Blob ≤ 1MB via `canvas.toBlob` with quality reduction loop (REQ-HGAL-071)
- [x] 3.4 Implement Supabase Storage upload: path `{orden}/{timestamp}.{ext}`, get public URL, call `onUploadComplete(url)` (REQ-HGAL-070, design §Upload Flow)
- [x] 3.5 Add error handling: invalid format, file too large, upload failed — messages per design §Error Handling (REQ-HGAL-073)
- [x] 3.6 Add loading states: progress indicator during upload, spinner during crop processing
- [x] 3.7 Export component with props interface matching design §ImageUpload Component Props
- [x] 3.8 Verify: `tsc --noEmit` passes

## Phase 4: GallerySection Integration

- [x] 4.1 Refactor slot editor to dual mode: two tabs "Pegar URL" / "Subir imagen" per slot (REQ-HGAL-072)
- [x] 4.2 Integrate `<ImageUpload>` in upload tab — wire `onUploadComplete` to update slot `image_url` state
- [x] 4.3 Ensure upload overwrites URL mode: switching tabs or uploading replaces `image_url` (REQ-HGAL-072)
- [x] 4.4 Add inline error display for upload and CRUD errors following `getApiError()` pattern (REQ-HGAL-073)
- [x] 4.5 Add success feedback: inline "Slot guardado" / "Imagen subida" messages
- [x] 4.6 Verify: `tsc --noEmit` passes

## Phase 5: Verification

- [x] 5.1 Type check: `cd frontend && npx tsc --noEmit` — zero errors
- [ ] 5.2 Manual test: upload flow — select file → crop modal → confirm → verify Supabase Storage URL in slot preview
- [ ] 5.3 Manual test: URL paste flow — paste URL → verify preview → save → verify PATCH uses DB id
- [ ] 5.4 Manual test: bug fix — delete slot 3, create new slot 3, verify save/delete/toggle work with new id
- [ ] 5.5 Manual test: error cases — oversized file, invalid format, network error
- [ ] 5.6 Verify existing gallery functionality: CRUD, active/inactive toggle, public render unaffected

## Relevant Files

- `frontend/src/lib/supabase.ts` — **Create** — Supabase client initialization
- `frontend/src/components/admin/ImageUpload.tsx` — **Create** — Upload + crop/resize component (~250 lines)
- `frontend/src/components/admin/GallerySection.tsx` — **Modify** — Bug fix + upload integration + UI/UX
- `frontend/package.json` — **Modify** — Add `@supabase/supabase-js` dependency
- `frontend/.env.example` — **Modify** — Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
