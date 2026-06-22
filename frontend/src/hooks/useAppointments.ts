import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listAppointments, createAppointment, updateAppointmentStatus, updateAppointment, deleteAppointment } from '../api'

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () => listAppointments(),
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => createAppointment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['busy-slots'] })
    },
  })
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appointmentId, payload }: { appointmentId: number; payload: Record<string, unknown> }) =>
      updateAppointment(appointmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['busy-slots'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ appointmentId, estado_cita, monto_recibido_en_caja }: { appointmentId: number; estado_cita: string; monto_recibido_en_caja?: number }) =>
      updateAppointmentStatus(appointmentId, { estado_cita, monto_recibido_en_caja }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appointmentId: number) => deleteAppointment(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['busy-slots'] })
    },
  })
}
