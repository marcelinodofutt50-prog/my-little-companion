import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/mercado' as any)({
  loader: () => {
    throw redirect({
      to: '/mercado' as any,
    })
  },
})
