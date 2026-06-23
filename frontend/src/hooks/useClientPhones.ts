import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addPhone, updatePhone, deletePhone } from '../api'
import type { ClienteTelefonoCreate, ClienteTelefonoUpdate } from '../api'

export function useAddPhone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, payload }: { clientId: number; payload: ClienteTelefonoCreate }) =>
      addPhone(clientId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useUpdatePhone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, phoneId, payload }: { clientId: number; phoneId: number; payload: ClienteTelefonoUpdate }) =>
      updatePhone(clientId, phoneId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeletePhone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, phoneId }: { clientId: number; phoneId: number }) =>
      deletePhone(clientId, phoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
