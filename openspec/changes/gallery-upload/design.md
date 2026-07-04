# Design: `gallery-upload`

## Technical Approach

Direct browser→Supabase Storage upload with client-side image processing. Backend remains stateless — no new endpoints. Frontend handles file validation, crop/resize, compression, and upload via `@supabase/supabase-js`. Dual mode (URL paste + file upload) coexists. Bug fix: mutation handlers pass DB `id` instead of `orden`.

## Architecture Decisions

### Decision: Browser→Supabase direct upload

**Choice**: Frontend uploads directly to Supabase Storage via `@supabase/supabase-js`  
**Alternatives considered**: Backend proxy with signed URLs, backend upload endpoint  
**Rationale**: Backend stays stateless, reduces latency, leverages Supabase RLS for auth. No new Python dependencies or endpoints needed.

### Decision: Client-side image processing

**Choice**: Canvas-based crop/resize + compression before upload  
**Alternatives considered**: Server-side processing (sharp), Supabase Edge Functions  
**Rationale**: Reduces upload size (≤1MB), gives admin control over final image, no backend processing load.

### Decision: Dual mode (URL + upload)

**Choice**: Two tabs per slot: "Pegar URL" and "Subir imagen"  
**Alternatives considered**: Replace URL mode entirely, single mode with file picker  
**Rationale**: Preserves existing workflow for external URLs (Instagram, CDN), allows gradual migration.

### Decision: Storage path convention

**Choice**: `{orden}/{timestamp}.{ext}`  
**Alternatives considered**: `{orden}/{filename}`, `{orden}/{uuid}.{ext}`  
**Rationale**: Timestamp ensures uniqueness, orden organizes by slot, extension preserved for MIME type.

## Data Flow

```
Admin selects file → Client validation (type, size ≤5MB)
    ↓
Crop/resize modal (canvas, 4:3 or 1:1, zoom/pan)
    ↓
Compression to ≤1MB (canvas.toBlob)
    ↓
Upload to Supabase Storage (browser→Supabase, no backend)
    ↓
Public URL returned → Update `image_url` in slot state
    ↓
PATCH /gallery/{id} with new `image_url` (backend validates URL)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/lib/supabase.ts` | Create | Supabase client init with VITE env vars |
| `frontend/src/components/admin/ImageUpload.tsx` | Create | Upload + crop/resize component |
| `frontend/src/components/admin/GallerySection.tsx` | Modify | Bug fix (orden→id), upload integration, UI/UX |
| `frontend/package.json` | Modify | Add `@supabase/supabase-js` |
| `frontend/.env.example` | Modify | Add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY |

## Interfaces / Contracts

### Supabase Client Init

```typescript
// frontend/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### ImageUpload Component Props

```typescript
interface ImageUploadProps {
  orden: number
  currentImageUrl: string | null
  onUploadComplete: (url: string) => void
  onError: (message: string) => void
}
```

### Upload Flow

```typescript
// 1. Validate file
const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
if (!validTypes.includes(file.type)) {
  onError('Formato no soportado. Usá JPG, PNG, WebP o GIF')
  return
}
if (file.size > 5 * 1024 * 1024) {
  onError('La imagen no puede superar 5MB')
  return
}

// 2. Process image (crop/resize/compress)
const processedBlob = await processImage(file, { aspect: '4:3', maxWidth: 1200, maxSize: 1024 * 1024 })

// 3. Upload to Supabase Storage
const path = `${orden}/${Date.now()}.${file.type.split('/')[1]}`
const { data, error } = await supabase.storage
  .from('gallery-images')
  .upload(path, processedBlob)

// 4. Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('gallery-images')
  .getPublicUrl(path)

// 5. Callback with URL
onUploadComplete(publicUrl)
```

### Bug Fix: orden vs id

```typescript
// BROKEN (current):
function handleSaveSlot(orden: number) {
  const slotData = getSlot(orden)
  updateGalleryMutation.mutate({ id: orden, payload: {...} })
}

// FIXED:
function handleSaveSlot(orden: number) {
  const slotData = getSlot(orden)
  const itemId = gallery.find(item => item.orden === orden)?.id
  if (!itemId) return
  updateGalleryMutation.mutate({ id: itemId, payload: {...} })
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | ImageUpload component | Type checking with `tsc --noEmit` |
| Unit | Supabase client init | Verify env vars are read correctly |
| Integration | Upload flow | Manual testing: file select → crop → upload → URL |
| Integration | Bug fix | Manual testing: delete slot → create new → save/delete works |
| E2E | Full admin workflow | Manual: upload image, paste URL, toggle active, delete |

## Migration / Rollout

### Supabase Storage Setup

1. Create bucket `gallery-images` in Supabase dashboard
2. Configure RLS policies:
   - `SELECT`: Allow public read
   - `INSERT/UPDATE/DELETE`: Allow authenticated users only
3. Set environment variables:
   - `VITE_SUPABASE_URL`: Supabase project URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase anon key

### Deployment Steps

1. Merge PR with frontend changes
2. Set env vars in Vercel/Render
3. Create Supabase bucket and policies
4. Test upload flow in production

## Open Questions

- [ ] Should we add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to backend .env for future server-side operations?
- [ ] Do we need to migrate existing external URLs to Supabase Storage, or keep them as-is?
- [ ] Should we add image optimization (WebP conversion) during upload?

## Security Considerations

1. **Supabase anon key exposure**: Safe for public read, restricted write via RLS
2. **File validation**: Client-side type/size check, server-side URL validation
3. **RLS policies**: Only authenticated users can upload/modify
4. **Path traversal**: Storage path uses `orden` (1-6) and timestamp, no user input
5. **Size limits**: 5MB client-side, 1MB after compression

## Error Handling

| Error Type | User Message | Technical Details |
|------------|--------------|-------------------|
| Invalid format | "Formato no soportado. Usá JPG, PNG, WebP o GIF" | Check `file.type` against whitelist |
| File too large | "La imagen no puede superar 5MB" | Check `file.size > 5MB` |
| Upload failed | "No se pudo subir la imagen. Verificá tu conexión y reintenta" | Supabase storage error |
| Network error | "Error de conexión. Verificá tu internet" | Fetch/network error |
| orden conflict | "Ya existe un slot activo con ese orden" | Backend 409 response |
| Slot not found | "Slot no encontrado" | Backend 404 response |

## Dependencies

### New npm packages
- `@supabase/supabase-js`: Supabase client for browser→Storage upload

### New Python packages
- None (backend stays stateless)

### Environment variables
- `VITE_SUPABASE_URL`: Supabase project URL (e.g., `https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/public key

## Supabase Storage Configuration

### Bucket: `gallery-images`
- **Public read**: Yes (for public gallery display)
- **Authenticated write**: Yes (admin only via RLS)
- **File size limit**: 5MB (enforced client-side)
- **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

### RLS Policies

```sql
-- Public read access
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id = 'gallery-images');

-- Authenticated insert
CREATE POLICY "Authenticated insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'gallery-images' AND auth.uid() IS NOT NULL);

-- Authenticated update
CREATE POLICY "Authenticated update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'gallery-images' AND auth.uid() IS NOT NULL);

-- Authenticated delete
CREATE POLICY "Authenticated delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'gallery-images' AND auth.uid() IS NOT NULL);
```

## UI/UX Improvements

### Dual Mode Interface
- Two tabs per slot: "Pegar URL" and "Subir imagen"
- Clear visual separation between modes
- Upload tab shows file picker + crop/resize modal
- URL tab shows input with preview

### Loading States
- Upload progress bar during Supabase Storage upload
- Spinner during crop/resize processing
- Disabled buttons during mutation calls

### Success/Error Feedback
- Inline success messages ("Slot guardado", "Imagen subida")
- Inline error messages with clear actions
- Toast notifications for critical errors

### Responsive Layout
- Mobile-first design
- Touch-friendly crop/resize controls
- Flexible grid for slot editors