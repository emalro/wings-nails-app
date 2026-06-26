import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppointments, useServices, useConfig, useUpdateConfig, useUpdateAppointment, useUpdateAppointmentStatus, useCreateService, useUpdateService, useDeleteService, useDeleteAppointment, useWeeklySchedule, useUpdateWeeklySchedule, useExceptions, useCreateException, useDeleteException } from '../hooks'
import { useAuth } from '../hooks/useAuth'
import CalendarView from '../components/CalendarView'
import AppointmentModal from '../components/AppointmentModal'
import MarkAttendedModal from '../components/MarkAttendedModal'
import ManualAppointmentModal from '../components/ManualAppointmentModal'
import ClientSection from '../components/ClientSection'
import ServicesSection from '../components/admin/ServicesSection'
import BusinessConfigSection from '../components/admin/BusinessConfigSection'
import ScheduleSection from '../components/admin/ScheduleSection'
import ExceptionsSection from '../components/admin/ExceptionsSection'
import DataTable from '../components/DataTable'
import type { Column } from '../components/DataTable'

type AppointmentService = {
  servicio_id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_unitario: number
  subtotal: number
}

type Appointment = {
  id: number
  id_cliente: number
  cliente_nombre?: string
  fecha_hora_cita: string
  precio_historico_cobrado: number
  sena_historica_pagada: number
  comprobante_transferencia_url?: string
  comprobante_verificado_manual: boolean
  monto_recibido_en_caja: number
  estado_cita: string
  metodo_pago_sena: string
  fecha_registro_cita: string
  duracion_total_minutos: number
  servicios: AppointmentService[]
}

type Service = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
  activo: boolean
}

export default function Admin() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: '/login', search: { reason: 'auth-required' } })
    }
  }, [authLoading, isAuthenticated, navigate])

  if (authLoading || !isAuthenticated) {
    return null
  }

  const [showInactive, setShowInactive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedCita, setSelectedCita] = useState<Appointment | null>(null)
  const [showAttendedModal, setShowAttendedModal] = useState(false)
  const [serviceMessage, setServiceMessage] = useState<string | null>(null)
  const [servicePayload, setServicePayload] = useState({
    nombre_servicio: '',
    duracion_minutos: 45,
    precio_actual: 0,
    monto_sena_actual: 0,
    descripcion: '',
  })
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null)
  const [editingServicePayload, setEditingServicePayload] = useState({
    nombre_servicio: '',
    duracion_minutos: 45,
    precio_actual: 0,
    monto_sena_actual: 0,
    descripcion: '',
  })
  const [showManualModal, setShowManualModal] = useState(false)
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('')

  const { data: appointments = [], isLoading: loading, refetch: refetchAppointments } = useAppointments()
  const filteredAppointments = appointmentStatusFilter
    ? appointments.filter((a: any) => a.estado_cita === appointmentStatusFilter)
    : appointments
  const { data: services = [], isLoading: serviceLoading } = useServices(showInactive)

  const statusMutation = useUpdateAppointmentStatus()
  const updateMutation = useUpdateAppointment()
  const createServiceMutation = useCreateService()
  const updateServiceMutation = useUpdateService()
  const deleteServiceMutation = useDeleteService()
  const deleteAppointmentMutation = useDeleteAppointment()

  const { data: config, isLoading: configLoading } = useConfig()
  const updateConfigMutation = useUpdateConfig()
  const [configForm, setConfigForm] = useState({
    business_name: '',
    facebook_url: '',
    instagram_url: '',
    whatsapp_number: '',
    address: '',
    cbu_alias: '',
    cbu_number: '',
  })
  const [configMessage, setConfigMessage] = useState<string | null>(null)

  // Horarios state
  const { data: weeklySchedule = [], isLoading: weeklyLoading } = useWeeklySchedule()
  const updateWeeklyMutation = useUpdateWeeklySchedule()
  const { data: exceptions = [], isLoading: exceptionsLoading } = useExceptions()
  const createExceptionMutation = useCreateException()
  const deleteExceptionMutation = useDeleteException()

  const [scheduleForm, setScheduleForm] = useState<Record<number, { activo: boolean; hora_apertura: string; hora_cierre: string }>>({})
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [exceptionDate, setExceptionDate] = useState('')
  const [exceptionCerrado, setExceptionCerrado] = useState(false)
  const [exceptionApertura, setExceptionApertura] = useState('09:00')
  const [exceptionCierre, setExceptionCierre] = useState('18:00')
  const [exceptionMessage, setExceptionMessage] = useState<string | null>(null)

  // Sync weekly schedule data into form
  useEffect(() => {
    if (weeklySchedule.length > 0) {
      const form: Record<number, { activo: boolean; hora_apertura: string; hora_cierre: string }> = {}
      for (const day of weeklySchedule) {
        form[day.dia_semana] = { activo: day.activo, hora_apertura: day.hora_apertura, hora_cierre: day.hora_cierre }
      }
      setScheduleForm(form)
    }
  }, [weeklySchedule])

  function handleSaveWeekly() {
    setScheduleMessage(null)
    const items = Object.entries(scheduleForm).map(([dia_semana, data]) => ({
      dia_semana: Number(dia_semana),
      activo: data.activo,
      hora_apertura: data.hora_apertura,
      hora_cierre: data.hora_cierre,
    }))
    updateWeeklyMutation.mutate(items, {
      onSuccess: () => setScheduleMessage('Horario semanal guardado.'),
      onError: () => setScheduleMessage('Error al guardar el horario.'),
    })
  }

  function handleAddException() {
    if (!exceptionDate) return
    setExceptionMessage(null)
    const payload: any = { fecha: exceptionDate, cerrado: exceptionCerrado }
    if (!exceptionCerrado) {
      payload.hora_apertura = exceptionApertura
      payload.hora_cierre = exceptionCierre
    }
    createExceptionMutation.mutate(payload, {
      onSuccess: () => {
        setExceptionMessage('Excepción agregada.')
        setExceptionDate('')
        setExceptionCerrado(false)
        setExceptionApertura('09:00')
        setExceptionCierre('18:00')
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.detail || 'Error al agregar excepción.'
        setExceptionMessage(detail)
      },
    })
  }

  function handleDeleteException(id: number) {
    deleteExceptionMutation.mutate(id, {
      onError: () => setExceptionMessage('Error al eliminar excepción.'),
    })
  }

  useEffect(() => {
    if (config) {
      setConfigForm({
        business_name: config.business_name || '',
        facebook_url: config.facebook_url || '',
        instagram_url: config.instagram_url || '',
        whatsapp_number: config.whatsapp_number || '',
        address: config.address || '',
        cbu_alias: config.cbu_alias || '',
        cbu_number: config.cbu_number || '',
      })
    }
  }, [config])

  function handleUpdateConfig(e: React.FormEvent) {
    e.preventDefault()
    setConfigMessage(null)
    updateConfigMutation.mutate(configForm, {
      onSuccess: () => setConfigMessage('Configuración guardada.'),
      onError: () => setConfigMessage('Error al guardar la configuración.'),
    })
  }

  function handleStatusChange(id: number, estado: string) {
    statusMutation.mutate(
      { appointmentId: id, estado_cita: estado },
      { onError: () => setError('Error al actualizar el estado.') },
    )
  }

  function handleSaveAppointment(appointmentId: number, payload: Record<string, unknown>) {
    setError(null)
    updateMutation.mutate(
      { appointmentId, payload },
      {
        onSuccess: (data: any) => {
          setSelectedCita(data)
        },
        onError: (err: any) => {
          const detail = err?.response?.data?.detail || 'Error al guardar los cambios.'
          setError(detail)
        },
      },
    )
  }

  function handleEventClick(cita: Appointment) {
    setSelectedCita(cita)
  }

  function handleMarkAttended(cita: Appointment) {
    setSelectedCita(cita)
    setShowAttendedModal(true)
  }

  function handleConfirmAttended(appointmentId: number, montoRecibido: number) {
    setError(null)
    statusMutation.mutate(
      { appointmentId, estado_cita: 'Asistido', monto_recibido_en_caja: montoRecibido },
      {
        onSuccess: () => {
          setSelectedCita(null)
          setShowAttendedModal(false)
        },
        onError: (err) => setError('Error al marcar como asistido.'),
      },
    )
  }

  function handleCreateService(e: React.FormEvent) {
    e.preventDefault()
    setServiceMessage(null)
    createServiceMutation.mutate(servicePayload, {
      onSuccess: () => {
        setServiceMessage('Servicio creado.')
        setServicePayload({ nombre_servicio: '', duracion_minutos: 45, precio_actual: 0, monto_sena_actual: 0, descripcion: '' })
      },
      onError: () => setServiceMessage('No se pudo crear el servicio.'),
    })
  }

  function startEditingService(service: Service) {
    setEditingServiceId(service.id)
    setEditingServicePayload({
      nombre_servicio: service.nombre_servicio,
      duracion_minutos: service.duracion_minutos,
      precio_actual: service.precio_actual,
      monto_sena_actual: service.monto_sena_actual,
      descripcion: service.descripcion,
    })
    setServiceMessage(null)
  }

  function handleUpdateService(e: React.FormEvent) {
    e.preventDefault()
    if (!editingServiceId) return
    updateServiceMutation.mutate(
      { serviceId: editingServiceId, payload: editingServicePayload },
      {
        onSuccess: () => { setServiceMessage('Servicio actualizado.'); setEditingServiceId(null) },
        onError: () => setServiceMessage('No se pudo actualizar el servicio.'),
      },
    )
  }

  function handleToggleServiceActive(serviceId: number, currentActive: boolean) {
    updateServiceMutation.mutate(
      { serviceId, payload: { activo: !currentActive } },
      {
        onSuccess: () => setServiceMessage(
          currentActive ? 'Servicio inactivado.' : 'Servicio reactivado.'
        ),
      },
    )
  }

  function handleDeleteService(serviceId: number) {
    if (!window.confirm('¿Eliminar este servicio definitivamente?')) return
    deleteServiceMutation.mutate(serviceId, {
      onSuccess: () => setServiceMessage('Servicio eliminado.'),
      onError: () => setServiceMessage('No se pudo eliminar el servicio.'),
    })
  }

  function handleDeleteAppointment(appointmentId: number) {
    if (!window.confirm('¿Eliminar esta cita definitivamente?')) return
    deleteAppointmentMutation.mutate(appointmentId)
  }

  return (
    <div className="content" style={{ paddingBottom: 48 }}>
      <div className="page-header">
        <h2>Panel Administrativo</h2>
        <p>Gestioná servicios, turnos y estados.</p>
      </div>

      {error && <div className="status-notice error">{error}</div>}

      {/* ── AGENDA ── */}
      <section style={{ marginTop: 32 }}>
        <div className="section-header" style={{ textAlign: 'left' }}>
          <span className="overline">Turnos</span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginTop: 4 }}>Agenda visual</h2>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por estado:</span>
            <select
              value={appointmentStatusFilter}
              onChange={(e) => setAppointmentStatusFilter(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: '.85rem' }}
            >
              <option value="">Todos</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Confirmado">Confirmado</option>
              <option value="Asistido">Asistido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <button
            type="button"
            className="button-primary"
            onClick={() => setShowManualModal(true)}
            style={{ width: 'auto', padding: '10px 20px' }}
          >
            Cargar Turno Manual
          </button>
        </div>

        {filteredAppointments.length > 0 && loading === false && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 12 }}>Lista de turnos</h3>
            <DataTable
              columns={[
                { key: 'cliente_nombre', label: 'Cliente', sortable: true, filterable: true },
                {
                  key: 'servicios',
                  label: 'Servicio(s)',
                  filterable: true,
                  filterValue: (a: any) => (a.servicios || []).map((s: any) => s.nombre_servicio).join(' '),
                  render: (_v: any, row: any) => {
                    if (!row.servicios || row.servicios.length === 0) return <span className="data-table-null">&mdash;</span>
                    const names = row.servicios.map((s: any) => s.nombre_servicio)
                    if (names.length <= 3) return names.join(', ')
                    return `${names.slice(0, 3).join(', ')} y ${names.length - 3} m\u00E1s`
                  },
                },
                {
                  key: 'fecha_hora_cita',
                  label: 'Fecha',
                  sortable: true,
                  sortFn: (a: any, b: any) => new Date(a.fecha_hora_cita).getTime() - new Date(b.fecha_hora_cita).getTime(),
                  render: (v: string) => {
                    if (!v) return <span className="data-table-null">&mdash;</span>
                    return new Date(v).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  },
                },
                {
                  key: '_hora',
                  label: 'Hora',
                  render: (_v: any, row: any) => {
                    if (!row.fecha_hora_cita) return <span className="data-table-null">&mdash;</span>
                    return new Date(row.fecha_hora_cita).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                  },
                },
                { key: 'estado_cita', label: 'Estado', sortable: true },
                {
                  key: 'actions',
                  label: 'Acciones',
                  render: (_v: any, row: any) => (
                    <div className="data-table-actions">
                      <button className="primary" type="button" onClick={() => handleMarkAttended(row)}>Asisti\u00F3</button>
                      <button className="danger" type="button" onClick={() => handleDeleteAppointment(row.id)}>Eliminar</button>
                    </div>
                  ),
                },
              ]}
              data={filteredAppointments}
              keyExtractor={(a: any) => a.id}
              isLoading={false}
              emptyMessage="No hay turnos registrados."
              searchPlaceholder="Buscar turno..."
              pageSize={15}
            />
          </div>
        )}

        <CalendarView
          appointments={appointments}
          loading={loading}
          onEventClick={handleEventClick}
        />
      </section>

      {/* ── HORARIOS ── */}
      <details open className="admin-card collapsible-card" style={{ marginTop: 24 }}>
        <summary>
          Horarios de Atención
          <span className="chevron">›</span>
        </summary>
        <div className="collapsible-body">
          <ScheduleSection
            scheduleForm={scheduleForm}
            setScheduleForm={setScheduleForm}
            weeklyLoading={weeklyLoading}
            updateWeeklyMutation={updateWeeklyMutation}
            scheduleMessage={scheduleMessage}
            handleSaveWeekly={handleSaveWeekly}
          />
        </div>
      </details>

      {/* ── EXCEPCIONES ── */}
      <details className="admin-card collapsible-card" style={{ marginTop: 16 }}>
        <summary>
          Excepciones
          <span className="chevron">›</span>
        </summary>
        <div className="collapsible-body">
          <ExceptionsSection
            exceptionDate={exceptionDate}
            setExceptionDate={setExceptionDate}
            exceptionCerrado={exceptionCerrado}
            setExceptionCerrado={setExceptionCerrado}
            exceptionApertura={exceptionApertura}
            setExceptionApertura={setExceptionApertura}
            exceptionCierre={exceptionCierre}
            setExceptionCierre={setExceptionCierre}
            exceptionMessage={exceptionMessage}
            exceptionsLoading={exceptionsLoading}
            exceptions={exceptions}
            createExceptionMutation={createExceptionMutation}
            handleAddException={handleAddException}
            handleDeleteException={handleDeleteException}
          />
        </div>
      </details>

      {/* ── CONFIGURACIÓN DEL NEGOCIO ── */}
      <details className="admin-card collapsible-card" style={{ marginTop: 24 }}>
        <summary>
          Configuración del negocio
          <span className="chevron">›</span>
        </summary>
        <div className="collapsible-body">
          <BusinessConfigSection
            configForm={configForm}
            setConfigForm={setConfigForm}
            configLoading={configLoading}
            updateConfigMutation={updateConfigMutation}
            configMessage={configMessage}
            handleUpdateConfig={handleUpdateConfig}
          />
        </div>
      </details>

      {/* ── CLIENTAS ── */}
      <details className="admin-card collapsible-card" style={{ marginTop: 24 }}>
        <summary>
          Clientas
          <span className="chevron">›</span>
        </summary>
        <div className="collapsible-body">
          <ClientSection />
        </div>
      </details>

      {/* ── SERVICIOS ── */}
      <details className="admin-card collapsible-card" style={{ marginTop: 24 }}>
        <summary>
          Servicios
          <span className="chevron">›</span>
        </summary>
        <div className="collapsible-body">
          <ServicesSection
            showInactive={showInactive}
            setShowInactive={setShowInactive}
            services={services}
            serviceLoading={serviceLoading}
            servicePayload={servicePayload}
            setServicePayload={setServicePayload}
            editingServiceId={editingServiceId}
            setEditingServiceId={setEditingServiceId}
            editingServicePayload={editingServicePayload}
            setEditingServicePayload={setEditingServicePayload}
            serviceMessage={serviceMessage}
            createServiceMutation={createServiceMutation}
            updateServiceMutation={updateServiceMutation}
            handleCreateService={handleCreateService}
            startEditingService={startEditingService}
            handleUpdateService={handleUpdateService}
            handleToggleServiceActive={handleToggleServiceActive}
            handleDeleteService={handleDeleteService}
          />
        </div>
      </details>

      {/* ── MODALES ── */}
      {selectedCita && !showAttendedModal && (
        <AppointmentModal
          cita={selectedCita}
          onClose={() => setSelectedCita(null)}
          onSave={handleSaveAppointment}
          onMarkAttended={handleMarkAttended}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteAppointment}
          isPending={updateMutation.isPending}
          error={error}
        />
      )}

      {selectedCita && showAttendedModal && (
        <MarkAttendedModal
          cita={selectedCita}
          onClose={() => { setSelectedCita(null); setShowAttendedModal(false) }}
          onConfirm={handleConfirmAttended}
          isPending={statusMutation.isPending}
          error={error}
        />
      )}

      <ManualAppointmentModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onAppointmentCreated={() => {
          refetchAppointments()
        }}
      />
    </div>
  )
}