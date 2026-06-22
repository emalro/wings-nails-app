import { useQuery } from '@tanstack/react-query'
import { getBusySlots } from '../api'

export function useBusySlots(dateStr: string) {
  return useQuery({
    queryKey: ['busy-slots', dateStr],
    queryFn: () => getBusySlots(dateStr),
    enabled: dateStr.length > 0,
  })
}
