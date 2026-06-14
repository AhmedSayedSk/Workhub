'use client'

import { X, Plus } from 'lucide-react'
import type { ProjectStage } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { STAGE_META, STAGE_ORDER } from './stageMeta'
import { SIKAGIT_ENABLED } from '@/lib/sikagit-flag'
import { cn } from '@/lib/utils'

interface Props {
  enabledStages: ProjectStage[]
  activeStage: ProjectStage
  canManage: boolean
  onSelect: (stage: ProjectStage) => void
  onEnable: (stage: ProjectStage) => void | Promise<void>
  onDisable: (stage: ProjectStage) => void | Promise<void>
}

export function StageStrip({ enabledStages, activeStage, canManage, onSelect, onEnable, onDisable }: Props) {
  const enabledSet = new Set(enabledStages)
  const disabledStages = STAGE_ORDER.filter(
    // Don't offer 'repos' in the "Add stage" menu when sikagit is gated off (prod).
    (s) => !enabledSet.has(s) && (SIKAGIT_ENABLED || s !== 'repos'),
  )

  return (
    <div className="flex flex-wrap items-center gap-2 pb-1">
      {STAGE_ORDER.filter((s) => enabledSet.has(s)).map((stage) => {
        const meta = STAGE_META[stage]
        const Icon = meta.icon
        const isActive = stage === activeStage
        return (
          <div key={stage} className="group relative">
            <button
              type="button"
              onClick={() => onSelect(stage)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition',
                isActive ? meta.pillClass : 'bg-background text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
            </button>
            {canManage && stage !== 'build' && stage !== 'next' && (
              <button
                type="button"
                aria-label={`Disable ${meta.label}`}
                onClick={() => onDisable(stage)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground group-hover:flex"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        )
      })}

      {/* Single compact "+" to enable any disabled stage */}
      {canManage && disabledStages.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Add stage"
              title="Add stage"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">Add a stage</p>
            <div className="space-y-0.5">
              {disabledStages.map((stage) => {
                const meta = STAGE_META[stage]
                const Icon = meta.icon
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => onEnable(stage)}
                    className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
                  >
                    <span className={cn('mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', meta.pillClass)}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{meta.label}</span>
                      <span className="block text-xs text-muted-foreground line-clamp-2">{meta.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
