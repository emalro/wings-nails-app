import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient, searchClients, getClients, getClient, updateClient, deleteClient, reactivateClient } from '../api'
import type { ClienteUpdate } from '../api'

export function useCreateClient() {
  return useMutation({
    mutationFn: (payload: any) => createClient(payload),
  })
}

export function useClientsList(query: string, incluirInactivos = false) {
  return useQuery({
    queryKey: ['clients', 'list', query, incluirInactivos],
    queryFn: () => {
      if (query.length >= 2) {
        return searchClients(query, incluirInactivos)
      }
      return getClients(incluirInactivos)
    },
    staleTime: 30_000,
  })
}

export function useClient(clientId: number | null) {
  return useQuery({
    queryKey: ['clients', clientId],
    queryFn: () => getClient(clientId!),
    enabled: clientId !== null,
    staleTime: 10_000,
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ClienteUpdate }) => updateClient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useDeleteClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}

export function useReactivateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reactivateClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
  })
}
