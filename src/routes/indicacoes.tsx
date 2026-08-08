import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/indicacoes')({
  loader: () => {
    throw redirect({
      to: '/indicacoes',
      search: (prev) => prev,
    })
  },
})
