import axios from 'axios'

// Dev: Vite proxy routes /auth, /services, etc. to localhost:8000 (same-origin)
// Prod: set VITE_API_URL to Render backend URL
const BASE_URL = import.meta.env.VITE_API_URL || ''

// ── Token Management ────────────────────────────────────────────────────
const TOKEN_KEY = 'access_token'

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // localStorage unavailable — silent fail
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // localStorage unavailable — silent fail
  }
}

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Attach Authorization header to every request if token exists
api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Auth API ───────────────────────────────────────────────────────────

export interface UserRead {
  email: string
  role: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: UserRead
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const r = await api.post('/auth/login', { email, password })
  setToken(r.data.access_token)
  return r.data
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
  clearToken()
}

export async function getMe(): Promise<UserRead> {
  const r = await api.get('/auth/me')
  return r.data
}

export async function refreshToken(): Promise<{ access_token: string }> {
  const r = await api.post('/auth/refresh')
  return r.data
}

// ── Axios Interceptors ─────────────────────────────────────────────────

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

function processQueue(error: unknown) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(undefined)
    }
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh for initial auth check or explicit skip
    if (originalRequest.skipAuthRefresh) {
      return Promise.reject(error)
    }

    // If 401 and not already retrying, attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const data = await refreshToken()
        setToken(data.access_token)
        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        // Redirect to login with session-expired reason
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login?reason=session-expired'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

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
  sobre_mi: string
}

// ── Service Type ──────────────────────────────────────────────────────
// A-7: was redeclared as `type Service` in Reservar.tsx, Home.tsx,
// Admin.tsx, and admin/ServicesSection.tsx with three slightly different
// shapes (some including `activo`, some not). Centralize the canonical
// read shape here so every screen compiles against the same model.
// The backend always returns `activo: boolean` (ServicioRead inherits
// ServicioBase with `activo: bool = True`), so it stays non-optional.
export type Servicio = {
  id: number
  nombre_servicio: string
  duracion_minutos: number
  precio_actual: number
  monto_sena_actual: number
  descripcion: string
  activo: boolean
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

// ── Public Booking (unauthenticated) ────────────────────────────────────
// Used by /reservar for logged-out visitors. The honeypot field is sent
// as an empty string for legitimate visitors; spam-bots that fill every
// DOM input will send a non-empty value and the server returns a silent
// 200 with no DB write (D2, REQ-PUB-005). The frontend treats the silent
// 200 as a real success — it cannot and should not distinguish.

export type PublicClientLookupRequest = {
  dni: string
  nombre: string
  apellido: string
  telefono: string
  email?: string | null
  honeypot: string
}

export type PublicClientLookupResponse = {
  id: number
  was_existing: boolean
}

export type PublicCitaServicioCreate = {
  servicio_id: number
  duracion_minutos: number
  precio_unitario: number
  subtotal: number
}

export type PublicAppointmentCreate = {
  dni: string
  servicios: PublicCitaServicioCreate[]
  fecha_hora_cita: string
  precio_historico_cobrado: number
  sena_historica_pagada: number
  honeypot: string
}

export type PublicAppointmentResponse = {
  id: number
  fecha_hora_cita: string
  estado_cita: string
}

export async function lookupOrCreatePublicClient(
  payload: PublicClientLookupRequest,
): Promise<PublicClientLookupResponse> {
  const r = await api.post('/public/clients', payload)
  return r.data
}

export async function createPublicAppointment(
  payload: PublicAppointmentCreate,
): Promise<PublicAppointmentResponse> {
  const r = await api.post('/public/appointments', payload)
  return r.data
}

// ── Gallery Types ────────────────────────────────────────────────────────

export type GalleryItemRead = {
  id: number
  orden: number
  image_url: string
  alt_text: string
  link_url: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type GalleryItemCreate = {
  orden: number
  image_url: string
  alt_text: string
  link_url?: string | null
  activo?: boolean
}

export type GalleryItemUpdate = {
  image_url?: string
  alt_text?: string
  link_url?: string | null
  activo?: boolean
}

// ── Gallery API ──────────────────────────────────────────────────────────

export async function getGallery(): Promise<GalleryItemRead[]> {
  const r = await api.get('/gallery')
  return r.data
}

export async function createGalleryItem(payload: GalleryItemCreate): Promise<GalleryItemRead> {
  const r = await api.post('/gallery', payload)
  return r.data
}

export async function updateGalleryItem(id: number, payload: GalleryItemUpdate): Promise<GalleryItemRead> {
  const r = await api.patch(`/gallery/${id}`, payload)
  return r.data
}

export async function deleteGalleryItem(id: number): Promise<void> {
  await api.delete(`/gallery/${id}`)
}

// ── Testimonial Types ───────────────────────────────────────────────────

export type TestimonialRead = {
  id: number
  nombre: string
  rol: string | null
  quote: string
  activo: boolean
  orden: number
  created_at: string
  updated_at: string
}

export type TestimonialCreate = {
  nombre: string
  rol?: string | null
  quote: string
  activo?: boolean
  orden?: number
}

export type TestimonialUpdate = {
  nombre?: string
  rol?: string | null
  quote?: string
  activo?: boolean
  orden?: number
}

// ── Testimonial API ─────────────────────────────────────────────────────

export async function getTestimonials(): Promise<TestimonialRead[]> {
  const r = await api.get('/testimonials')
  return r.data
}

export async function getAllTestimonials(): Promise<TestimonialRead[]> {
  const r = await api.get('/testimonials/all')
  return r.data
}

export async function createTestimonial(payload: TestimonialCreate): Promise<TestimonialRead> {
  const r = await api.post('/testimonials', payload)
  return r.data
}

export async function updateTestimonial(id: number, payload: TestimonialUpdate): Promise<TestimonialRead> {
  const r = await api.patch(`/testimonials/${id}`, payload)
  return r.data
}

export async function deleteTestimonial(id: number): Promise<void> {
  await api.delete(`/testimonials/${id}`)
}

export async function deleteStorageFile(bucket: string, path: string): Promise<void> {
  await api.delete(`/storage/delete`, { params: { bucket, path } })
}
