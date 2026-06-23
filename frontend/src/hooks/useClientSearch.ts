import { useQuery } from '@tanstack/react-query'
import { searchClients } from '../api'

export function useClientSearch(query: string, incluirInactivos = false) {
  return useQuery({
    queryKey: ['clients', 'search', query, incluirInactivos],
    queryFn: () => searchClients(query, incluirInactivos),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
