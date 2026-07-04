import React, { useState, useRef } from 'react'
import type { GalleryItemRead, GalleryItemCreate, GalleryItemUpdate } from '../../api'
import { getApiError } from '../../lib/apiErrors'
import ImageUpload from './ImageUpload'
import { deleteStorageFile } from '../../api'

type GallerySlot = {
  orden: number
  image_url: string
  alt_text: string
  link_url: string
  activo: boolean
}

type SlotFeedback = {
  type: 'success' | 'error' | null
  message: string
}

type GallerySectionProps = {
  showInactive: boolean
  setShowInactive: React.Dispatch<React.SetStateAction<boolean>>
  gallery: GalleryItemRead[]
  galleryLoading: boolean
  createGalleryMutation: { isPending: boolean; mutate: (payload: GalleryItemCreate, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
  updateGalleryMutation: { isPending: boolean; mutate: (args: { id: number; payload: GalleryItemUpdate }, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
  deleteGalleryMutation: { isPending: boolean; mutate: (galleryItemId: number, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
}

const SLOT_COUNT = 6
const DEBOUNCE_MS = 300

function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timeoutId: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), ms)
  }) as T
}

export default function GallerySection({
  showInactive,
  setShowInactive,
  gallery,
  galleryLoading,
  createGalleryMutation,
  updateGalleryMutation,
  deleteGalleryMutation,
}: GallerySectionProps) {
  // Previews keyed by orden
  const [previews, setPreviews] = useState<Record<number, string | null>>({})
  const [previewErrors, setPreviewErrors] = useState<Record<number, boolean>>({})
  const [slotErrors, setSlotErrors] = useState<Record<number, string>>({})
  const previewImgRefs = useRef<Record<number, HTMLImageElement | null>>({})
  const [galleryMessage, setGalleryMessage] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ image_url: '', alt_text: '', link_url: '' })

  // Local edits per slot — overrides server state until "Guardar" is clicked
  const [slotEdits, setSlotEdits] = useState<Record<number, { alt_text?: string; link_url?: string; image_url?: string }>>({})

  // Dual mode: active tab per slot ('url' | 'upload')
  const [activeTabs, setActiveTabs] = useState<Record<number, 'url' | 'upload'>>({})

  // Create form tab
  const [createTab, setCreateTab] = useState<'url' | 'upload'>('url')

  // Per-slot feedback for upload and CRUD operations
  const [slotFeedback, setSlotFeedback] = useState<Record<number, SlotFeedback>>({})

  // Debounced fetch for thumbnail
  const fetchPreview = React.useCallback(
    debounce(async (url: string, orden: number) => {
      if (!url || !url.startsWith('http')) {
        setPreviews((prev) => ({ ...prev, [orden]: null }))
        setPreviewErrors((prev) => ({ ...prev, [orden]: false }))
        return
      }
      try {
        const img = new Image()
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load'))
        })
        setPreviews((prev) => ({ ...prev, [orden]: url }))
        setPreviewErrors((prev) => ({ ...prev, [orden]: false }))
      } catch {
        setPreviews((prev) => ({ ...prev, [orden]: null }))
        setPreviewErrors((prev) => ({ ...prev, [orden]: true }))
      }
    }, DEBOUNCE_MS),
    []
  )

  // Create a slot object from gallery item or defaults, merged with local edits
  const getSlot = (orden: number): GallerySlot => {
    const item = gallery.find((g) => g.orden === orden)
    const edits = slotEdits[orden] ?? {}
    if (item) {
      return {
        orden: item.orden,
        image_url: edits.image_url ?? item.image_url,
        alt_text: edits.alt_text ?? item.alt_text,
        link_url: edits.link_url ?? (item.link_url ?? ''),
        activo: item.activo,
      }
    }
    return {
      orden,
      image_url: edits.image_url ?? '',
      alt_text: edits.alt_text ?? '',
      link_url: edits.link_url ?? '',
      activo: true,
    }
  }

  function clearSlotFeedback(orden: number) {
    setSlotFeedback((prev) => ({ ...prev, [orden]: { type: null, message: '' } }))
  }

  function handleImageUrlChange(orden: number, value: string) {
    clearSlotFeedback(orden)
    setSlotErrors((prev) => ({ ...prev, [orden]: '' }))
    setSlotEdits((prev) => ({ ...prev, [orden]: { ...prev[orden], image_url: value } }))
    fetchPreview(value, orden)
  }

  function handleAltTextChange(orden: number, value: string) {
    setSlotEdits((prev) => ({ ...prev, [orden]: { ...prev[orden], alt_text: value } }))
    setSlotErrors((prev) => ({ ...prev, [orden]: '' }))
  }

  function handleLinkUrlChange(orden: number, value: string) {
    setSlotEdits((prev) => ({ ...prev, [orden]: { ...prev[orden], link_url: value } }))
  }

  function validateSlot(slot: GallerySlot): string | null {
    if (!slot.alt_text.trim()) {
      return 'El texto alternativo es obligatorio'
    }
    return null
  }

  function handleSaveSlot(orden: number) {
    const slotData = getSlot(orden)
    const error = validateSlot(slotData)
    if (error) {
      setSlotErrors((prev) => ({ ...prev, [orden]: error }))
      return
    }
    const itemId = gallery.find((g) => g.orden === orden)?.id
    if (!itemId) return
    setGalleryMessage(null)
    clearSlotFeedback(orden)
    updateGalleryMutation.mutate(
      { id: itemId, payload: { image_url: slotData.image_url, alt_text: slotData.alt_text, link_url: slotData.link_url || null, activo: slotData.activo } },
      {
        onSuccess: () => {
          // Clear local edits after successful save
          setSlotEdits((prev) => {
            const next = { ...prev }
            delete next[orden]
            return next
          })
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'success', message: 'Slot guardado.' } }))
          setTimeout(() => clearSlotFeedback(orden), 3000)
        },
        onError: (err: unknown) => {
          const apiErr = getApiError(err)
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'error', message: apiErr.message } }))
        },
      },
    )
  }

  function handleToggleActive(orden: number) {
    const slotData = getSlot(orden)
    const itemId = gallery.find((g) => g.orden === orden)?.id
    if (!itemId) return
    setGalleryMessage(null)
    clearSlotFeedback(orden)
    updateGalleryMutation.mutate(
      { id: itemId, payload: { activo: !slotData.activo } },
      {
        onSuccess: () => {
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'success', message: slotData.activo ? 'Slot inactivado.' : 'Slot reactivado.' } }))
          setTimeout(() => clearSlotFeedback(orden), 3000)
        },
        onError: (err: unknown) => {
          const apiErr = getApiError(err)
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'error', message: apiErr.message } }))
        },
      },
    )
  }

  function handleDeleteSlot(orden: number) {
    if (!window.confirm(`¿Eliminar el slot ${orden} de la galería?`)) return
    const item = gallery.find((g) => g.orden === orden)
    if (!item) return
    setGalleryMessage(null)
    clearSlotFeedback(orden)

    // Delete from Supabase Storage via backend (service_role bypasses RLS)
    const deleteFromStorage = async (): Promise<boolean> => {
      if (!item.image_url.includes('supabase.co/storage')) return true
      try {
        const url = new URL(item.image_url)
        const marker = '/storage/v1/object/'
        const idx = url.pathname.indexOf(marker)
        if (idx === -1) return true
        const afterMarker = url.pathname.substring(idx + marker.length)
        const segments = afterMarker.split('/')
        if (segments.length < 3) return true
        const bucket = segments[1]
        const filePath = segments.slice(2).join('/')
        console.log('[GallerySection] Deleting from storage via backend:', { bucket, filePath })
        await deleteStorageFile(bucket, filePath)
        return true
      } catch (err) {
        console.error('[GallerySection] Failed to delete from Supabase Storage:', err)
        return false
      }
    }

    deleteFromStorage().then((storageOk) => {
      if (!storageOk) {
        setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'error', message: 'No se pudo borrar la imagen de Supabase. Se eliminó solo el registro.' } }))
      }
      deleteGalleryMutation.mutate(item.id, {
        onSuccess: () => {
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'success', message: 'Slot eliminado.' } }))
          setTimeout(() => clearSlotFeedback(orden), 3000)
        },
        onError: (err: unknown) => {
          const apiErr = getApiError(err)
          setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'error', message: apiErr.message } }))
        },
      })
    })
  }

  function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault()
    if (nextFreeOrden === null) return
    setGalleryMessage(null)
    const payload: GalleryItemCreate = {
      orden: nextFreeOrden,
      image_url: createForm.image_url,
      alt_text: createForm.alt_text,
      link_url: createForm.link_url || null,
      activo: true,
    }
    createGalleryMutation.mutate(payload, {
      onSuccess: () => {
        setGalleryMessage('Item agregado a la galería.')
        setCreateForm({ image_url: '', alt_text: '', link_url: '' })
        setPreviews((prev) => { const next = { ...prev }; delete next[0]; return next })
        setCreateTab('url')
      },
      onError: (err: unknown) => {
        const apiErr = getApiError(err)
        setGalleryMessage(apiErr.message)
      },
    })
  }

  function handleSlotTabChange(orden: number, tab: 'url' | 'upload') {
    setActiveTabs((prev) => ({ ...prev, [orden]: tab }))
    clearSlotFeedback(orden)
  }

  function handleUploadComplete(orden: number, url: string) {
    // Update both preview and local slot edit so the URL persists across tab switches
    setPreviews((prev) => ({ ...prev, [orden]: url }))
    setPreviewErrors((prev) => ({ ...prev, [orden]: false }))
    setSlotEdits((prev) => ({ ...prev, [orden]: { ...prev[orden], image_url: url } }))
    setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'success', message: 'Imagen subida. Hacé click en Guardar para persistir.' } }))
    setTimeout(() => clearSlotFeedback(orden), 5000)
  }

  function handleUploadError(orden: number, message: string) {
    setSlotFeedback((prev) => ({ ...prev, [orden]: { type: 'error', message } }))
  }

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)
  const nextFreeOrden = slots.find((orden) => !gallery.some((g) => g.orden === orden)) ?? null

  return (
    <div className="admin-grid">
      <div>
        <h3>Crear item de galería</h3>
        {nextFreeOrden === null ? (
          <div className="status-notice" style={{ padding: '16px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
            Todos los slots están ocupados. Eliminá uno para crear un nuevo item.
          </div>
        ) : (
          <form onSubmit={handleCreateSlot} className="service-form">
            <label>
              Slot
              <input
                type="number"
                value={nextFreeOrden}
                readOnly
                style={{ background: 'var(--surface-container)', cursor: 'not-allowed' }}
              />
            </label>

            {/* Dual mode tabs for create */}
            <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--outline-variant)' }}>
              <button
                type="button"
                onClick={() => setCreateTab('url')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: '.85rem', fontWeight: 600,
                  border: 'none',
                  borderBottom: createTab === 'url' ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'transparent',
                  color: createTab === 'url' ? 'var(--primary)' : 'var(--on-surface-variant)',
                  cursor: 'pointer',
                }}
              >
                Pegar URL
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('upload')}
                style={{
                  flex: 1, padding: '8px 12px', fontSize: '.85rem', fontWeight: 600,
                  border: 'none',
                  borderBottom: createTab === 'upload' ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'transparent',
                  color: createTab === 'upload' ? 'var(--primary)' : 'var(--on-surface-variant)',
                  cursor: 'pointer',
                }}
              >
                Subir imagen
              </button>
            </div>

            <div style={{ display: 'grid', gap: '10px', marginTop: '10px' }}>
              {createTab === 'url' ? (
                <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                  URL de imagen
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
                    <input
                      value={createForm.image_url}
                      onChange={(e) => {
                        setCreateForm((prev) => ({ ...prev, image_url: e.target.value }))
                        fetchPreview(e.target.value, 0)
                      }}
                      placeholder="https://..."
                      required={createTab === 'url'}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                    {previews[0] && (
                      <img
                        src={previews[0]}
                        alt="Preview"
                        width={60}
                        height={60}
                        style={{ objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--outline-variant)', flexShrink: 0 }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </label>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {previews[0] && (
                    <img
                      src={previews[0]}
                      alt="Preview"
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--outline-variant)' }}
                    />
                  )}
                  <ImageUpload
                    orden={nextFreeOrden}
                    currentImageUrl={null}
                    onUploadComplete={(url) => {
                      setCreateForm((prev) => ({ ...prev, image_url: url }))
                      setPreviews((prev) => ({ ...prev, [0]: url }))
                    }}
                    onError={(msg) => setGalleryMessage(msg)}
                  />
                </div>
              )}
            </div>

            <label>
              Texto alternativo <span aria-hidden="true">*</span>
              <input
                value={createForm.alt_text}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, alt_text: e.target.value }))}
                required
              />
            </label>
            <label>
              URL de enlace (opcional)
              <input
                value={createForm.link_url}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, link_url: e.target.value }))}
                placeholder="https://..."
              />
            </label>
            <button
              className="button-primary"
              type="submit"
              disabled={createGalleryMutation.isPending || createForm.alt_text.trim() === '' || (createTab === 'url' && !createForm.image_url)}
            >
              {createGalleryMutation.isPending ? 'Creando...' : 'Agregar a galería'}
            </button>
          </form>
        )}
      </div>

      <div>
        <h3>Galería</h3>
        <label className="checkbox-row">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>

        {galleryMessage && (
          <div
            className="status-notice"
            style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: 'var(--surface-container-highest)', fontSize: '.9rem' }}
            role="status"
            aria-live="polite"
          >
            {galleryMessage}
          </div>
        )}

        {slots.map((orden) => {
          const slotData = getSlot(orden)
          const isExisting = gallery.some((g) => g.orden === orden)
          const isActive = slotData.activo
          const showRow = showInactive || isActive

          if (!showRow) return null

          const previewUrl = previews[orden]
          const hasPreviewError = previewErrors[orden]
          const slotError = slotErrors[orden]
          const feedback = slotFeedback[orden]
          const activeTab = activeTabs[orden] ?? 'url'

          return (
            <div key={orden} className="edit-card" style={{ marginTop: '16px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'start' }}>
                {/* Orden label */}
                <div style={{ fontWeight: 600, color: 'var(--on-surface-variant)', minWidth: '60px' }}>
                  Orden: {orden}
                </div>

                {/* Form fields */}
                <div style={{ display: 'grid', gap: '10px', flex: 1 }}>
                  {/* Dual mode tabs */}
                  <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--outline-variant)' }}>
                    <button
                      type="button"
                      onClick={() => handleSlotTabChange(orden, 'url')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '.85rem',
                        fontWeight: 600,
                        border: 'none',
                        borderBottom: activeTab === 'url' ? '2px solid var(--primary, #6750a4)' : '2px solid transparent',
                        background: 'transparent',
                        color: activeTab === 'url' ? 'var(--primary, #6750a4)' : 'var(--on-surface-variant)',
                        cursor: 'pointer',
                      }}
                      aria-selected={activeTab === 'url'}
                      role="tab"
                    >
                      Pegar URL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSlotTabChange(orden, 'upload')}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '.85rem',
                        fontWeight: 600,
                        border: 'none',
                        borderBottom: activeTab === 'upload' ? '2px solid var(--primary, #6750a4)' : '2px solid transparent',
                        background: 'transparent',
                        color: activeTab === 'upload' ? 'var(--primary, #6750a4)' : 'var(--on-surface-variant)',
                        cursor: 'pointer',
                      }}
                      aria-selected={activeTab === 'upload'}
                      role="tab"
                    >
                      Subir imagen
                    </button>
                  </div>

                  {/* Tab content */}
                  <div role="tabpanel">
                    {activeTab === 'url' ? (
                      /* URL tab */
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
                        <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                          URL de imagen
                          <input
                            type="url"
                            value={slotData.image_url}
                            onChange={(e) => handleImageUrlChange(orden, e.target.value)}
                            placeholder="https://..."
                            className="service-form-input"
                            style={{ padding: '10px 12px', fontSize: '.9rem' }}
                            aria-describedby={slotError ? `error-${orden}` : hasPreviewError ? `preview-error-${orden}` : undefined}
                          />
                        </label>
                        {/* Thumbnail preview */}
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt=""
                            width={60}
                            height={60}
                            style={{
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid var(--outline-variant)',
                              flexShrink: 0,
                            }}
                            ref={(el) => { previewImgRefs.current[orden] = el }}
                            aria-hidden="true"
                          />
                        )}
                        {hasPreviewError && !previewUrl && (
                          <div
                            id={`preview-error-${orden}`}
                            style={{
                              width: 60,
                              height: 60,
                              border: '1px dashed var(--status-cancelled)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--status-cancelled)',
                              fontSize: '.7rem',
                              textAlign: 'center',
                              padding: '4px',
                            }}
                            role="status"
                            aria-live="polite"
                          >
                            No se pudo cargar
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Upload tab */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt="Preview de imagen subida"
                            width={80}
                            height={80}
                            style={{
                              objectFit: 'cover',
                              borderRadius: '8px',
                              border: '1px solid var(--outline-variant)',
                            }}
                          />
                        )}
                        <ImageUpload
                          orden={orden}
                          currentImageUrl={slotData.image_url || null}
                          onUploadComplete={(url) => handleUploadComplete(orden, url)}
                          onError={(msg) => handleUploadError(orden, msg)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inline feedback for this slot */}
                  {feedback?.type && (
                    <div
                      role="alert"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '.85rem',
                        background: feedback.type === 'success' ? 'var(--surface-container-highest)' : 'var(--status-cancelled-container, #fdecea)',
                        color: feedback.type === 'success' ? 'var(--on-surface)' : 'var(--status-cancelled, #b3261e)',
                      }}
                    >
                      {feedback.message}
                    </div>
                  )}

                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    Texto alternativo <span aria-hidden="true">*</span>
                    <input
                      value={slotData.alt_text}
                      onChange={(e) => handleAltTextChange(orden, e.target.value)}
                      required
                      className={slotError ? 'input-error' : ''}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                      aria-describedby={slotError ? `error-${orden}` : undefined}
                    />
                    {slotError && (
                      <span id={`error-${orden}`} className="field-error" role="alert">
                        {slotError}
                      </span>
                    )}
                  </label>

                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    URL de enlace (opcional)
                    <input
                      type="url"
                      value={slotData.link_url}
                      onChange={(e) => handleLinkUrlChange(orden, e.target.value)}
                      placeholder="https://..."
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                  </label>

                  <label className="checkbox-row" style={{ marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggleActive(orden)}
                      style={{ minWidth: 24, minHeight: 24 }}
                    />
                    Activo
                  </label>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '140px' }}>
                  {isExisting ? (
                    <>
                      <button
                        type="button"
                        className="button-primary"
                        style={{ padding: '10px 14px', fontSize: '.9rem', width: '100%' }}
                        onClick={() => handleSaveSlot(orden)}
                        disabled={updateGalleryMutation.isPending}
                      >
                        {updateGalleryMutation.isPending ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        type="button"
                        className="button-primary danger"
                        style={{
                          padding: '10px 14px',
                          fontSize: '.9rem',
                          width: '100%',
                          background: 'var(--status-cancelled)',
                          borderColor: 'var(--status-cancelled)',
                          color: 'var(--on-primary)',
                        }}
                        onClick={() => handleDeleteSlot(orden)}
                        disabled={deleteGalleryMutation.isPending}
                      >
                        {deleteGalleryMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </>
                  ) : (
                    <span style={{ color: 'var(--on-surface-variant)', fontSize: '.85rem', textAlign: 'center', paddingTop: '8px' }}>
                      Slot vacío
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {galleryLoading && <div className="status-notice" style={{ marginTop: '16px' }}>Cargando galería...</div>}
      </div>
    </div>
  )
}
