import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/presentes')({
  loader: () => {
    throw redirect({
      to: '/presentes' as any,
    })
  },
})

