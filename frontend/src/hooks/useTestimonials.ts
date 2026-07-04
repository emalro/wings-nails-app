import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, type TestimonialRead, type TestimonialCreate, type TestimonialUpdate } from '../api'

/**
 * Admin testimonials hook.
 * Returns all testimonials (active + inactive) ordered by `orden` ASC.
 */
export function useTestimonials() {
  return useQuery({
    queryKey: ['testimonials'],
    queryFn: getAllTestimonials,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useCreateTestimonial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: TestimonialCreate) => createTestimonial(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
    },
  })
}

export function useUpdateTestimonial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TestimonialUpdate }) =>
      updateTestimonial(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
    },
  })
}

export function useDeleteTestimonial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTestimonial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] })
    },
  })
}

export type { TestimonialRead }
