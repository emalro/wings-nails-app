import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listServices, createService, updateService, deleteService } from '../api'

export function useServices(all = false) {
  return useQuery({
    queryKey: ['services', all],
    queryFn: () => listServices(all),
  })
}

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => createService(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: number; payload: any }) =>
      updateService(serviceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (serviceId: number) => deleteService(serviceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
    },
  })
}
