import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/mercado')({
  loader: () => {
    throw redirect({
      to: '/mercado',
    })
  },
})
