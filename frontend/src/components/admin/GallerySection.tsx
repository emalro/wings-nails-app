import React, { useState, useEffect, useRef } from 'react'
import type { GalleryItemRead, GalleryItemCreate, GalleryItemUpdate } from '../../api'

type GallerySlot = {
  orden: number
  image_url: string
  alt_text: string
  link_url: string
  activo: boolean
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

  // Create a slot object from gallery item or defaults
  const getSlot = (orden: number): GallerySlot => {
    const item = gallery.find((g) => g.orden === orden)
    if (item) {
      return {
        orden: item.orden,
        image_url: item.image_url,
        alt_text: item.alt_text,
        link_url: item.link_url ?? '',
        activo: item.activo,
      }
    }
    return {
      orden,
      image_url: '',
      alt_text: '',
      link_url: '',
      activo: true,
    }
  }

  function handleImageUrlChange(orden: number, value: string) {
    const slotData = getSlot(orden)
    const updatedSlot = { ...slotData, image_url: value }
    setSlotErrors((prev) => ({ ...prev, [orden]: '' }))
    fetchPreview(value, orden)
  }

  function handleAltTextChange(orden: number, value: string) {
    setSlotErrors((prev) => ({ ...prev, [orden]: '' }))
  }

  function handleLinkUrlChange(orden: number, value: string) {
    // no validation needed
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
    setGalleryMessage(null)
    updateGalleryMutation.mutate(
      { id: orden, payload: { image_url: slotData.image_url, alt_text: slotData.alt_text, link_url: slotData.link_url || null, activo: slotData.activo } },
      {
        onSuccess: () => setGalleryMessage('Slot guardado.'),
        onError: () => setGalleryMessage('Error al guardar el slot.'),
      },
    )
  }

  function handleToggleActive(orden: number) {
    const slotData = getSlot(orden)
    setGalleryMessage(null)
    updateGalleryMutation.mutate(
      { id: orden, payload: { activo: !slotData.activo } },
      {
        onSuccess: () => setGalleryMessage(slotData.activo ? 'Slot inactivado.' : 'Slot reactivado.'),
        onError: () => setGalleryMessage('Error al cambiar estado del slot.'),
      },
    )
  }

  function handleDeleteSlot(orden: number) {
    if (!window.confirm(`¿Eliminar el slot ${orden} de la galería?`)) return
    setGalleryMessage(null)
    deleteGalleryMutation.mutate(orden, {
      onSuccess: () => setGalleryMessage('Slot eliminado.'),
      onError: () => setGalleryMessage('Error al eliminar el slot.'),
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
      },
      onError: () => setGalleryMessage('Error al crear item.'),
    })
  }

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)
  const nextFreeOrden = slots.find((orden) => !gallery.some((g) => g.orden === orden)) ?? null

  return (
    <div className="admin-grid">
      <div>
        <h3>Crear item de galería</h3>
        <form onSubmit={handleCreateSlot} className="service-form">
          <label>
            Orden (1-6)
            <input
              type="number"
              value={nextFreeOrden ?? ''}
              readOnly
              style={{ background: 'var(--surface-container)', cursor: 'not-allowed' }}
            />
          </label>
          <label>
            URL de imagen
            <input
              value={createForm.image_url}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://..."
              required
            />
          </label>
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
          <label className="checkbox-row">
            <input type="checkbox" defaultChecked={true} readOnly />
            Activo
          </label>
          <button
            className="button-primary"
            type="submit"
            disabled={createGalleryMutation.isPending || nextFreeOrden === null || createForm.alt_text.trim() === ''}
          >
            {createGalleryMutation.isPending ? 'Creando...' : nextFreeOrden === null ? 'Slots completos' : 'Agregar a galería'}
          </button>
        </form>
      </div>

      <div>
        <h3>Galería</h3>
        <label className="checkbox-row">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>

        {slots.map((orden) => {
          const slotData = getSlot(orden)
          const isExisting = gallery.some((g) => g.orden === orden)
          const isActive = slotData.activo
          const showRow = showInactive || isActive

          if (!showRow) return null

          const previewUrl = previews[orden]
          const hasPreviewError = previewErrors[orden]
          const slotError = slotErrors[orden]

          return (
            <div key={orden} className="edit-card" style={{ marginTop: '16px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'start' }}>
                {/* Orden label */}
                <div style={{ fontWeight: 600, color: 'var(--on-surface-variant)', minWidth: '60px' }}>
                  Orden: {orden}
                </div>

                {/* Form fields */}
                <div style={{ display: 'grid', gap: '10px', flex: 1 }}>
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