import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/indicacoes' as any)({
  loader: () => {
    throw redirect({
      to: '/indicacoes' as any,
    })
  },
})
