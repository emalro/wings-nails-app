import React from 'react'

type Service = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
  activo: boolean
}

type ServicePayload = {
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
}

type ServicesSectionProps = {
  showInactive: boolean
  setShowInactive: React.Dispatch<React.SetStateAction<boolean>>
  services: Service[]
  serviceLoading: boolean
  servicePayload: ServicePayload
  setServicePayload: React.Dispatch<React.SetStateAction<ServicePayload>>
  editingServiceId: number | null
  setEditingServiceId: React.Dispatch<React.SetStateAction<number | null>>
  editingServicePayload: ServicePayload
  setEditingServicePayload: React.Dispatch<React.SetStateAction<ServicePayload>>
  serviceMessage: string | null
  createServiceMutation: { isPending: boolean }
  updateServiceMutation: { isPending: boolean }
  handleCreateService: (e: React.FormEvent) => void
  startEditingService: (service: Service) => void
  handleUpdateService: (e: React.FormEvent) => void
  handleToggleServiceActive: (serviceId: number, currentActive: boolean) => void
  handleDeleteService: (serviceId: number) => void
}

export default function ServicesSection({
  showInactive,
  setShowInactive,
  services,
  serviceLoading,
  servicePayload,
  setServicePayload,
  editingServiceId,
  setEditingServiceId,
  editingServicePayload,
  setEditingServicePayload,
  serviceMessage,
  createServiceMutation,
  updateServiceMutation,
  handleCreateService,
  startEditingService,
  handleUpdateService,
  handleToggleServiceActive,
  handleDeleteService,
}: ServicesSectionProps) {
  return (
    <div className="admin-grid">
      <div>
        <h3>Crear servicio</h3>
        {serviceMessage && <div className="status-notice success">{serviceMessage}</div>}
        <form onSubmit={handleCreateService} className="service-form">
          <label>
            Nombre
            <input value={servicePayload.nombre_servicio} onChange={e => setServicePayload({ ...servicePayload, nombre_servicio: e.target.value })} required />
          </label>
          <label>
            Duración (min)
            <input type="number" value={servicePayload.duracion_minutos} onChange={e => setServicePayload({ ...servicePayload, duracion_minutos: Number(e.target.value) })} min={10} required />
          </label>
          <label>
            Precio
            <input type="number" value={servicePayload.precio_actual} onChange={e => setServicePayload({ ...servicePayload, precio_actual: Number(e.target.value) })} min={0} step={100} required />
          </label>
          <label>
            Seña
            <input type="number" value={servicePayload.monto_sena_actual} onChange={e => setServicePayload({ ...servicePayload, monto_sena_actual: Number(e.target.value) })} min={0} step={100} required />
          </label>
          <label>
            Descripción
            <textarea value={servicePayload.descripcion} onChange={e => setServicePayload({ ...servicePayload, descripcion: e.target.value })} required />
          </label>
          <button className="button-primary" type="submit" disabled={createServiceMutation.isPending}>
            {createServiceMutation.isPending ? 'Creando...' : 'Agregar servicio'}
          </button>
        </form>
      </div>

      <div>
        <h3>Servicios</h3>
        <label className="checkbox-row">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
          Mostrar inactivos
        </label>
        {serviceLoading ? (
          <p>Cargando...</p>
        ) : services.length === 0 ? (
          <p>No hay servicios.</p>
        ) : (
          <ul className="service-list-admin">
            {services.map((service) => (
              <li key={service.id} className="service-row">
                <div>
                  <strong>{service.nombre_servicio}</strong> — {service.duracion_minutos} min — ${service.precio_actual}
                  {!service.activo && <span style={{ color: 'var(--muted)', marginLeft: 8, fontSize: '.85rem' }}>Inactivo</span>}
                </div>
                <div className="service-actions">
                  <button type="button" onClick={() => startEditingService(service)}>Editar</button>
                  <button type="button" className={service.activo ? 'danger' : ''} onClick={() => handleToggleServiceActive(service.id, service.activo)}>
                    {service.activo ? 'Inactivar' : 'Activar'}
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeleteService(service.id)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editingServiceId && (
          <div className="edit-card">
            <h4>Editar servicio</h4>
            <form onSubmit={handleUpdateService} className="service-form">
              <label>
                Nombre
                <input value={editingServicePayload.nombre_servicio} onChange={e => setEditingServicePayload({ ...editingServicePayload, nombre_servicio: e.target.value })} required />
              </label>
              <label>
                Duración (min)
                <input type="number" value={editingServicePayload.duracion_minutos} onChange={e => setEditingServicePayload({ ...editingServicePayload, duracion_minutos: Number(e.target.value) })} min={10} required />
              </label>
              <label>
                Precio
                <input type="number" value={editingServicePayload.precio_actual} onChange={e => setEditingServicePayload({ ...editingServicePayload, precio_actual: Number(e.target.value) })} min={0} step={100} required />
              </label>
              <label>
                Seña
                <input type="number" value={editingServicePayload.monto_sena_actual} onChange={e => setEditingServicePayload({ ...editingServicePayload, monto_sena_actual: Number(e.target.value) })} min={0} step={100} required />
              </label>
              <label>
                Descripción
                <textarea value={editingServicePayload.descripcion} onChange={e => setEditingServicePayload({ ...editingServicePayload, descripcion: e.target.value })} required />
              </label>
              <div className="button-row">
                <button className="button-primary" type="submit" disabled={updateServiceMutation.isPending}>
                  {updateServiceMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setEditingServiceId(null)} style={{ padding: '12px 20px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}