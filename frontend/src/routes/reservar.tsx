import { createFileRoute } from '@tanstack/react-router'
import Reservar from '../pages/Reservar'

export const Route = createFileRoute('/reservar')({
  component: Reservar,
})
