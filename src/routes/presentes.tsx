import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/presentes')({
  beforeLoad: () => {
    throw redirect({
      to: '/presentes' as any,
    })
  },
})
