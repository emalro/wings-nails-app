import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

// ── Client Search ─────────────────────────────────────────────────────

export type ClienteRead = {
  id: number
  nombre: string
  apellido: string
  telefono: string
  fecha_creacion: string
  cantidad_turnos_tomados: number
  cantidad_turnos_abonados: number
  cantidad_turnos_cancelados_vencidos: number
}

export async function searchClients(q: string): Promise<ClienteRead[]> {
  const r = await api.get('/clients/search', { params: { q } })
  return r.data
}
