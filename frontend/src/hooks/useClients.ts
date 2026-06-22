import { useMutation } from '@tanstack/react-query'
import { createClient } from '../api'

export function useCreateClient() {
  return useMutation({
    mutationFn: (payload: any) => createClient(payload),
  })
}
