import axios from 'axios'

// Prod: misma origen (FastAPI sirve SPA + API) → URL relativa
// Dev: setear VITE_API_URL en .env (ej: http://localhost:8000)
const BASE_URL = import.meta.env.VITE_API_URL || ''

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

export async function listServices(all = false){
  const params = all ? { all: true } : {}
  const r = await api.get('/services', { params })
  return r.data
}

export async function createClient(payload: any){
  const r = await api.post('/clients', payload)
  return r.data
}

export async function createAppointment(payload: any){
  const r = await api.post('/appointments', payload)
  return r.data
}

export async function getBusySlots(date: string){
  const r = await api.get('/busy_slots', { params: { date_str: date } })
  return r.data
}

export async function createService(payload: any){
  const r = await api.post('/services', payload)
  return r.data
}

export async function listAppointments(){
  const r = await api.get('/appointments')
  return r.data
}

export async function updateAppointmentStatus(appointmentId: number, payload: { estado_cita: string; monto_recibido_en_caja?: number }){
  const r = await api.patch(`/appointments/${appointmentId}`, payload)
  return r.data
}

export async function updateAppointment(appointmentId: number, payload: Record<string, unknown>){
  const r = await api.patch(`/appointments/${appointmentId}`, payload)
  return r.data
}

export async function updateService(serviceId: number, payload: any){
  const r = await api.patch(`/services/${serviceId}`, payload)
  return r.data
}

export async function deleteService(serviceId: number){
  const r = await api.delete(`/services/${serviceId}`)
  return r.data
}

export async function deleteAppointment(appointmentId: number){
  const r = await api.delete(`/appointments/${appointmentId}`)
  return r.data
}

export async function getConfig(){
  const r = await api.get('/config')
  return r.data
}

export async function updateConfig(payload: any){
  const r = await api.put('/config', payload)
  return r.data
}

// ── Schedule API ──────────────────────────────────────────────────────────

export type HorarioSemanalRead = {
  id: number
  dia_semana: number
  activo: boolean
  hora_apertura: string
  hora_cierre: string
}

export type HorarioSemanalUpdate = {
  dia_semana: number
  activo: boolean
  hora_apertura: string
  hora_cierre: string
}

export type ExcepcionHorarioRead = {
  id: number
  fecha: string
  cerrado: boolean
  hora_apertura: string | null
  hora_cierre: string | null
}

export type ExcepcionHorarioCreate = {
  fecha: string
  cerrado: boolean
  hora_apertura?: string | null
  hora_cierre?: string | null
}

export type EffectiveHoursResponse = {
  abierto: boolean
  hora_apertura: string | null
  hora_cierre: string | null
}

export async function getWeeklySchedule(): Promise<HorarioSemanalRead[]> {
  const r = await api.get('/schedule/weekly')
  return r.data
}

export async function updateWeeklySchedule(data: HorarioSemanalUpdate[]): Promise<HorarioSemanalRead[]> {
  const r = await api.put('/schedule/weekly', data)
  return r.data
}

export async function getExceptions(): Promise<ExcepcionHorarioRead[]> {
  const r = await api.get('/schedule/exceptions')
  return r.data
}

export async function createException(data: ExcepcionHorarioCreate): Promise<ExcepcionHorarioRead> {
  const r = await api.post('/schedule/exceptions', data)
  return r.data
}

export async function deleteException(id: number): Promise<{ ok: boolean }> {
  const r = await api.delete(`/schedule/exceptions/${id}`)
  return r.data
}

export async function getEffectiveHours(date: string): Promise<EffectiveHoursResponse> {
  const r = await api.get('/schedule/effective', { params: { date } })
  return r.data
}

// ── Config Type ───────────────────────────────────────────────────────

export type ConfigType = {
  id: number
  business_name: string
  facebook_url: string
  instagram_url: string
  whatsapp_number: string
  address: string
  cbu_alias: string
  cbu_number: string
}

// ── Client Types ──────────────────────────────────────────────────────

export type ClienteTelefonoRead = {
  id: number
  id_cliente: number
  telefono: string
  etiqueta: string | null
  es_principal: boolean
}

export type ClienteTelefonoCreate = {
  telefono: string
  etiqueta?: string | null
}

export type ClienteTelefonoUpdate = {
  etiqueta?: string | null
  es_principal?: boolean | null
}

export type ClienteUpdate = {
  nombre?: string | null
  apellido?: string | null
  dni?: string | null
}

export type CitaServicioRead = {
  servicio_id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_unitario: number
  subtotal: number
}

export type CitaRead = {
  id: number
  id_cliente: number
  cliente_nombre: string | null
  fecha_hora_cita: string
  precio_historico_cobrado: number
  sena_historica_pagada: number
  comprobante_transferencia_url: string | null
  comprobante_verificado_manual: boolean
  monto_recibido_en_caja: number
  estado_cita: string
  metodo_pago_sena: string
  fecha_registro_cita: string
  duracion_total_minutos: number
  servicios: CitaServicioRead[]
}

export type ClienteRead = {
  id: number
  nombre: string
  apellido: string
  dni: string
  activo: boolean
  fecha_creacion: string
  cantidad_turnos_tomados: number
  cantidad_turnos_abonados: number
  cantidad_turnos_cancelados_vencidos: number
  telefonos: ClienteTelefonoRead[]
}

export async function searchClients(q: string, incluirInactivos = false): Promise<ClienteRead[]> {
  const r = await api.get('/clients/search', { params: { q, incluir_inactivos: incluirInactivos || undefined } })
  return r.data
}

export async function getClients(incluirInactivos = false): Promise<ClienteRead[]> {
  const r = await api.get('/clients', { params: { incluir_inactivos: incluirInactivos || undefined } })
  return r.data
}

export async function getClient(id: number): Promise<ClienteRead> {
  const r = await api.get(`/clients/${id}`)
  return r.data
}

export async function updateClient(id: number, payload: ClienteUpdate): Promise<ClienteRead> {
  const r = await api.patch(`/clients/${id}`, payload)
  return r.data
}

export async function deleteClient(id: number): Promise<void> {
  await api.delete(`/clients/${id}`)
}

export async function reactivateClient(id: number): Promise<ClienteRead> {
  const r = await api.post(`/clients/${id}/reactivate`)
  return r.data
}

export async function addPhone(clientId: number, payload: ClienteTelefonoCreate): Promise<ClienteTelefonoRead> {
  const r = await api.post(`/clients/${clientId}/phones`, payload)
  return r.data
}

export async function updatePhone(clientId: number, phoneId: number, payload: ClienteTelefonoUpdate): Promise<ClienteTelefonoRead> {
  const r = await api.patch(`/clients/${clientId}/phones/${phoneId}`, payload)
  return r.data
}

export async function deletePhone(clientId: number, phoneId: number): Promise<void> {
  await api.delete(`/clients/${clientId}/phones/${phoneId}`)
}

export async function getClientAppointments(id: number): Promise<CitaRead[]> {
  const r = await api.get(`/clients/${id}/appointments`)
  return r.data
}
