import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getConfig, updateConfig } from '../api'

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  })
}

export function useUpdateConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: any) => updateConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] })
    },
  })
}
