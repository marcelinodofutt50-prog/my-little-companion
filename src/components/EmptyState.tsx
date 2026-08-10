import { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    to?: string
    onClick?: () => void
  }
  secondary?: {
    label: string
    to?: string
    onClick?: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action, secondary }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border/70 bg-background/30 p-8 text-center">
      <div className="rounded-full border border-primary/20 bg-primary/5 p-4">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {action && action.to ? (
          <Link to={action.to}>
            <Button size="sm" className="font-mono text-[10px] uppercase">
              {action.label}
            </Button>
          </Link>
        ) : action ? (
          <Button size="sm" className="font-mono text-[10px] uppercase" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
        {secondary && secondary.to ? (
          <Link to={secondary.to}>
            <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase">
              {secondary.label}
            </Button>
          </Link>
        ) : secondary ? (
          <Button size="sm" variant="outline" className="font-mono text-[10px] uppercase" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
