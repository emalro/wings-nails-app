import React from 'react'
import DataTable from '../DataTable'
import type { Servicio } from '../../api'

type Service = Servicio

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
        <DataTable
          columns={[
            { key: 'nombre_servicio', label: 'Nombre', sortable: true, filterable: true },
            {
              key: 'duracion_minutos',
              label: 'Duración',
              sortable: true,
              render: (v: number) => (v != null ? `${v} min` : <span className="data-table-null">&mdash;</span>),
            },
            {
              key: 'precio_actual',
              label: 'Precio',
              sortable: true,
              render: (v: number) => (v != null ? `$${v.toLocaleString('es-AR')}` : <span className="data-table-null">&mdash;</span>),
            },
            {
              key: 'actions',
              label: 'Acciones',
              render: (_v: any, row: Service) => (
                <div className="data-table-actions">
                  <button type="button" onClick={() => startEditingService(row)}>Editar</button>
                  <button
                    type="button"
                    className={row.activo ? 'danger' : ''}
                    onClick={() => handleToggleServiceActive(row.id, row.activo)}
                  >
                    {row.activo ? 'Inactivar' : 'Activar'}
                  </button>
                  <button type="button" className="danger" onClick={() => handleDeleteService(row.id)}>
                    Eliminar
                  </button>
                  {!row.activo && (
                    <span className="self-center text-[var(--muted)] text-[.78rem]">Inactivo</span>
                  )}
                </div>
              ),
            },
          ]}
          data={services}
          keyExtractor={(s: Service) => s.id}
          isLoading={serviceLoading}
          emptyMessage="No hay servicios."
          searchPlaceholder="Buscar servicio..."
          pageSize={20}
        />

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
                <button type="button" onClick={() => setEditingServiceId(null)} className="py-3 px-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] font-semibold cursor-pointer">
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