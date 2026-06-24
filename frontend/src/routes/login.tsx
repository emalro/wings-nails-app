import { createFileRoute } from '@tanstack/react-router'
import Login from '../pages/Login'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, string | undefined>) => {
    return {
      reason: typeof search.reason === 'string' ? search.reason : undefined,
    }
  },
  component: Login,
})
