import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/servidor/status')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_authenticated/servidor/status"!</div>
}
