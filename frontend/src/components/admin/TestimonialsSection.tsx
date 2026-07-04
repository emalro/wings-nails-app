import React, { useState } from 'react'
import type { TestimonialRead, TestimonialCreate, TestimonialUpdate } from '../../api'
import { getApiError } from '../../lib/apiErrors'

type TestimonialsSectionProps = {
  testimonials: TestimonialRead[]
  testimonialsLoading: boolean
  createTestimonialMutation: { isPending: boolean; mutate: (payload: TestimonialCreate, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
  updateTestimonialMutation: { isPending: boolean; mutate: (args: { id: number; payload: TestimonialUpdate }, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
  deleteTestimonialMutation: { isPending: boolean; mutate: (testimonialId: number, opts?: { onSuccess?: () => void; onError?: (err: any) => void }) => void }
}

export default function TestimonialsSection({
  testimonials,
  testimonialsLoading,
  createTestimonialMutation,
  updateTestimonialMutation,
  deleteTestimonialMutation,
}: TestimonialsSectionProps) {
  const [createForm, setCreateForm] = useState({ nombre: '', rol: '', quote: '', orden: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ nombre: '', rol: '', quote: '', activo: true, orden: 0 })
  const [message, setMessage] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<number, { type: 'success' | 'error'; message: string }>>({})

  function clearFeedback(id: number) {
    setFeedback((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    const payload: TestimonialCreate = {
      nombre: createForm.nombre,
      rol: createForm.rol || null,
      quote: createForm.quote,
      activo: true,
      orden: createForm.orden,
    }
    createTestimonialMutation.mutate(payload, {
      onSuccess: () => {
        setMessage('Testimonio creado.')
        setCreateForm({ nombre: '', rol: '', quote: '', orden: 0 })
      },
      onError: (err: unknown) => {
        const apiErr = getApiError(err)
        setMessage(apiErr.message)
      },
    })
  }

  function startEditing(t: TestimonialRead) {
    setEditingId(t.id)
    setEditForm({ nombre: t.nombre, rol: t.rol ?? '', quote: t.quote, activo: t.activo, orden: t.orden })
    setFeedback((prev) => {
      const next = { ...prev }
      delete next[t.id]
      return next
    })
  }

  function handleSave(id: number) {
    clearFeedback(id)
    const payload: TestimonialUpdate = {
      nombre: editForm.nombre,
      rol: editForm.rol || null,
      quote: editForm.quote,
      activo: editForm.activo,
      orden: editForm.orden,
    }
    updateTestimonialMutation.mutate(
      { id, payload },
      {
        onSuccess: () => {
          setFeedback((prev) => ({ ...prev, [id]: { type: 'success', message: 'Guardado.' } }))
          setEditingId(null)
          setTimeout(() => clearFeedback(id), 3000)
        },
        onError: (err: unknown) => {
          const apiErr = getApiError(err)
          setFeedback((prev) => ({ ...prev, [id]: { type: 'error', message: apiErr.message } }))
        },
      },
    )
  }

  function handleToggleActive(t: TestimonialRead) {
    clearFeedback(t.id)
    updateTestimonialMutation.mutate(
      { id: t.id, payload: { activo: !t.activo } },
      {
        onSuccess: () => {
          setFeedback((prev) => ({ ...prev, [t.id]: { type: 'success', message: t.activo ? 'Inactivado.' : 'Activado.' } }))
          setTimeout(() => clearFeedback(t.id), 3000)
        },
        onError: (err: unknown) => {
          const apiErr = getApiError(err)
          setFeedback((prev) => ({ ...prev, [t.id]: { type: 'error', message: apiErr.message } }))
        },
      },
    )
  }

  function handleDelete(t: TestimonialRead) {
    if (!window.confirm(`¿Eliminar el testimonio de ${t.nombre}?`)) return
    clearFeedback(t.id)
    deleteTestimonialMutation.mutate(t.id, {
      onSuccess: () => {
        setFeedback((prev) => ({ ...prev, [t.id]: { type: 'success', message: 'Eliminado.' } }))
        setTimeout(() => clearFeedback(t.id), 3000)
      },
      onError: (err: unknown) => {
        const apiErr = getApiError(err)
        setFeedback((prev) => ({ ...prev, [t.id]: { type: 'error', message: apiErr.message } }))
      },
    })
  }

  return (
    <div className="admin-grid">
      {/* Create form */}
      <div>
        <h3>Crear testimonio</h3>
        <form onSubmit={handleCreate} className="service-form">
          <label>
            Nombre <span aria-hidden="true">*</span>
            <input
              value={createForm.nombre}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, nombre: e.target.value }))}
              required
              maxLength={100}
            />
          </label>
          <label>
            Rol (opcional)
            <input
              value={createForm.rol}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, rol: e.target.value }))}
              maxLength={100}
              placeholder="Ej: Clienta habitual"
            />
          </label>
          <label>
            Testimonio <span aria-hidden="true">*</span>
            <textarea
              value={createForm.quote}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, quote: e.target.value }))}
              required
              maxLength={500}
              rows={3}
            />
          </label>
          <label>
            Orden
            <input
              type="number"
              value={createForm.orden}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, orden: Number(e.target.value) }))}
              min={0}
            />
          </label>
          <button
            className="button-primary"
            type="submit"
            disabled={createTestimonialMutation.isPending || !createForm.nombre.trim() || !createForm.quote.trim()}
          >
            {createTestimonialMutation.isPending ? 'Creando...' : 'Crear testimonio'}
          </button>
        </form>
        {message && (
          <div className="status-notice" style={{ marginTop: '12px' }} role="status" aria-live="polite">
            {message}
          </div>
        )}
      </div>

      {/* List */}
      <div>
        <h3>Testimonios</h3>
        {testimonialsLoading && <div className="status-notice">Cargando testimonios...</div>}

        {!testimonialsLoading && testimonials.length === 0 && (
          <div className="status-notice" style={{ textAlign: 'center', color: 'var(--on-surface-variant)' }}>
            No hay testimonios aún.
          </div>
        )}

        {testimonials.map((t) => {
          const isEditing = editingId === t.id
          const fb = feedback[t.id]

          return (
            <div key={t.id} className="edit-card" style={{ marginTop: '16px', padding: '16px' }}>
              {isEditing ? (
                /* Edit mode */
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    Nombre
                    <input
                      value={editForm.nombre}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, nombre: e.target.value }))}
                      required
                      maxLength={100}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    Rol
                    <input
                      value={editForm.rol}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, rol: e.target.value }))}
                      maxLength={100}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    Testimonio
                    <textarea
                      value={editForm.quote}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, quote: e.target.value }))}
                      required
                      maxLength={500}
                      rows={3}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '6px', fontWeight: 600, fontSize: '.85rem' }}>
                    Orden
                    <input
                      type="number"
                      value={editForm.orden}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, orden: Number(e.target.value) }))}
                      min={0}
                      style={{ padding: '10px 12px', fontSize: '.9rem' }}
                    />
                  </label>
                  <label className="checkbox-row" style={{ marginTop: '4px' }}>
                    <input
                      type="checkbox"
                      checked={editForm.activo}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, activo: e.target.checked }))}
                      style={{ minWidth: 24, minHeight: 24 }}
                    />
                    Activo
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="button-primary"
                      style={{ padding: '10px 14px', fontSize: '.9rem' }}
                      onClick={() => handleSave(t.id)}
                      disabled={updateTestimonialMutation.isPending}
                    >
                      {updateTestimonialMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      style={{ padding: '10px 14px', fontSize: '.9rem', background: 'var(--surface-container)', color: 'var(--on-surface)' }}
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '4px' }}>
                      {t.nombre}
                      {t.rol && <span style={{ fontWeight: 400, color: 'var(--on-surface-variant)', marginLeft: '8px' }}>({t.rol})</span>}
                    </div>
                    <blockquote style={{ margin: '4px 0 8px', padding: '8px 12px', borderLeft: '3px solid var(--primary)', background: 'var(--surface-container)', borderRadius: '0 8px 8px 0', fontSize: '.9rem', color: 'var(--on-surface-variant)' }}>
                      &ldquo;{t.quote}&rdquo;
                    </blockquote>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '.8rem', color: 'var(--on-surface-variant)' }}>
                      <span>Orden: {t.orden}</span>
                      <span style={{ color: t.activo ? 'var(--status-confirmed)' : 'var(--status-cancelled)' }}>
                        {t.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                    <button
                      type="button"
                      className="button-primary"
                      style={{ padding: '10px 14px', fontSize: '.9rem', width: '100%' }}
                      onClick={() => startEditing(t)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="button-primary"
                      style={{
                        padding: '10px 14px', fontSize: '.9rem', width: '100%',
                        background: t.activo ? 'var(--status-cancelled)' : 'var(--status-confirmed)',
                        borderColor: t.activo ? 'var(--status-cancelled)' : 'var(--status-confirmed)',
                        color: 'var(--on-primary)',
                      }}
                      onClick={() => handleToggleActive(t)}
                      disabled={updateTestimonialMutation.isPending}
                    >
                      {t.activo ? 'Inactivar' : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="button-primary danger"
                      style={{
                        padding: '10px 14px', fontSize: '.9rem', width: '100%',
                        background: 'var(--status-cancelled)', borderColor: 'var(--status-cancelled)', color: 'var(--on-primary)',
                      }}
                      onClick={() => handleDelete(t)}
                      disabled={deleteTestimonialMutation.isPending}
                    >
                      {deleteTestimonialMutation.isPending ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              )}

              {fb?.type && (
                <div
                  role="alert"
                  style={{
                    marginTop: '8px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '.85rem',
                    background: fb.type === 'success' ? 'var(--surface-container-highest)' : 'var(--status-cancelled-container, #fdecea)',
                    color: fb.type === 'success' ? 'var(--on-surface)' : 'var(--status-cancelled, #b3261e)',
                  }}
                >
                  {fb.message}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
