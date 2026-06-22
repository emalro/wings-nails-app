import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAppointment } from '../api'

export function useCreateManualAppointment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => createAppointment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['busy-slots'] })
    },
  })
}
