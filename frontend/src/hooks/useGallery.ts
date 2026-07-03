import { useQuery } from '@tanstack/react-query'
import { getGallery, type GalleryItemRead } from '../api'

/**
 * Public gallery read hook.
 * Returns all 6 slots (active + inactive) ordered by `orden` ASC.
 * The frontend filters for `activo === true` when rendering.
 */
export function useGallery() {
  return useQuery({
    queryKey: ['gallery'],
    queryFn: getGallery,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

export type { GalleryItemRead }