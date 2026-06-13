'use client'

import type { ProjectStage } from '@/types'
import { Button } from '@/components/ui/button'
import { STAGE_META } from './stageMeta'

interface Props {
  stage: ProjectStage
  onCtaClick?: () => void
}

export function StageEmptyState({ stage, onCtaClick }: Props) {
  const meta = STAGE_META[stage]
  const Icon = meta.icon
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full border ${meta.pillClass}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">{meta.label}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{meta.description}</p>
      {onCtaClick && (
        <Button className="mt-6" onClick={onCtaClick}>
          {meta.emptyCta}
        </Button>
      )}
    </div>
  )
}
