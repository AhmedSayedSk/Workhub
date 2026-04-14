import { ShieldCheck, ShieldOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getWarrantyState, getWarrantyDaysLeft } from '@/lib/utils'
import type { Project } from '@/types'

interface WarrantyBadgeProps {
  project: Project
  className?: string
}

export function WarrantyBadge({ project, className }: WarrantyBadgeProps) {
  const state = getWarrantyState(project)
  if (state === 'none') return null

  if (state === 'active') {
    const daysLeft = getWarrantyDaysLeft(project)
    return (
      <Badge
        variant="outline"
        className={cn(
          'bg-amber-500/8 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/15 dark:border-amber-500/20 gap-1',
          className,
        )}
      >
        <ShieldCheck className="h-3 w-3" />
        {daysLeft} day{daysLeft === 1 ? '' : 's'} left
      </Badge>
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'bg-slate-500/8 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-500/15 dark:border-slate-500/20 gap-1',
        className,
      )}
    >
      <ShieldOff className="h-3 w-3" />
      Expired
    </Badge>
  )
}
