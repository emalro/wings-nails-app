import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWeeklySchedule,
  updateWeeklySchedule,
  getExceptions,
  createException,
  deleteException,
  getEffectiveHours,
  type HorarioSemanalUpdate,
  type ExcepcionHorarioCreate,
} from '../api'

export function useWeeklySchedule() {
  return useQuery({
    queryKey: ['weekly-schedule'],
    queryFn: getWeeklySchedule,
  })
}

export function useUpdateWeeklySchedule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: HorarioSemanalUpdate[]) => updateWeeklySchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule'] })
    },
  })
}

export function useExceptions() {
  return useQuery({
    queryKey: ['exceptions'],
    queryFn: getExceptions,
  })
}

export function useCreateException() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ExcepcionHorarioCreate) => createException(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] })
    },
  })
}

export function useDeleteException() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteException(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] })
    },
  })
}

export function useEffectiveHours(date: string) {
  return useQuery({
    queryKey: ['effective-hours', date],
    queryFn: () => getEffectiveHours(date),
    enabled: date.length > 0,
  })
}
