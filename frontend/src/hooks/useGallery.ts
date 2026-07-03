import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGallery, createGalleryItem, updateGalleryItem, deleteGalleryItem, type GalleryItemRead, type GalleryItemCreate, type GalleryItemUpdate } from '../api'

// Public read hook
export function useGallery() {
  return useQuery({
    queryKey: ['gallery'],
    queryFn: getGallery,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// Admin mutations
export function useCreateGalleryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: GalleryItemCreate) => createGalleryItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}

export function useUpdateGalleryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GalleryItemUpdate }) =>
      updateGalleryItem(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}

export function useDeleteGalleryItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteGalleryItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gallery'] })
    },
  })
}