import { createFileRoute, redirect } from '@tanstack/react-router'
import Admin from '../pages/Admin'
import { authPromise } from '../contexts/AuthContext'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const auth = await authPromise
    if (!auth.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: { reason: 'auth-required' },
      })
    }
  },
  component: Admin,
})
