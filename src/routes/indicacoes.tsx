import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/indicacoes')({
  beforeLoad: () => {
    throw redirect({
      to: '/indicacoes' as any,
    })
  },
})
