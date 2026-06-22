import { useQuery } from '@tanstack/react-query'
import { searchClients } from '../api'

export function useClientSearch(query: string) {
  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: () => searchClients(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  })
}
