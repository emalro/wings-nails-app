import { useQuery } from '@tanstack/react-query'
import { getClientAppointments } from '../api'
import type { CitaRead } from '../api'

export function useClientAppointments(clientId: number | null) {
  return useQuery<CitaRead[]>({
    queryKey: ['clients', clientId, 'appointments'],
    queryFn: () => getClientAppointments(clientId!),
    enabled: clientId !== null,
    staleTime: 10_000,
  })
}
