'use client'

import type { ProjectStage } from '@/types'
import { STAGE_META } from './stageMeta'
import { cn } from '@/lib/utils'

interface Props {
  stage: ProjectStage | null | undefined
  className?: string
}

export function StageBadge({ stage, className }: Props) {
  if (!stage) return null
  const meta = STAGE_META[stage]
  const Icon = meta.icon
  return (
    <span
      title={`Most recent stage: ${meta.label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.pillClass,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  )
}
