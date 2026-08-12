'use client'

import { useCallback, useEffect, useId, useState, type ReactNode } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Every panel on the server page collapses, and remembers whether it was
// collapsed across reloads. The state is per panel id and shared by all
// servers: the panels mean the same thing on each, so a layout you set up once
// should not have to be set up again on the next server you open.
const KEY = (id: string) => `vps-panel:${id}`

function readStored(id: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.localStorage.getItem(KEY(id))
    return v === null ? fallback : v === 'open'
  } catch {
    // Private-mode or blocked storage — the panel still works, it just forgets.
    return fallback
  }
}

/**
 * Open/closed state for one panel, persisted to localStorage.
 *
 * Exported because a panel that renders its own shell (the containers table
 * needs its header row to stay sticky inside a scroll area) still has to share
 * this behaviour rather than reimplement it.
 */
export function usePanelState(id: string, defaultOpen = true) {
  const [open, setOpen] = useState(() => readStored(id, defaultOpen))

  // Keep two views of the same server page in step, and pick up a state written
  // by another tab, without either one clobbering the other on load.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY(id) && e.newValue !== null) setOpen(e.newValue === 'open')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [id])

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(KEY(id), next ? 'open' : 'closed')
      } catch {
        /* storage unavailable — the toggle still works for this session */
      }
      return next
    })
  }, [id])

  return { open, toggle }
}

export function PanelToggle({
  open,
  onToggle,
  controls,
  icon: Icon,
  title,
  meta,
}: {
  open: boolean
  onToggle: () => void
  controls: string
  icon?: LucideIcon
  title: ReactNode
  meta?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      className="-m-1 flex min-w-0 flex-1 items-center gap-2 rounded-md p-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronDown
        className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
          !open && '-rotate-90'
        )}
      />
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      {/* Matches CardTitle's type scale without nesting a heading inside a
          button, which screen readers announce awkwardly. */}
      <span className="flex min-w-0 items-center gap-2 text-base font-semibold leading-none tracking-tight">
        {title}
        {meta}
      </span>
    </button>
  )
}

export function CollapsiblePanel({
  id,
  icon,
  title,
  meta,
  aside,
  defaultOpen = true,
  contentClassName,
  children,
}: {
  /** Stable key for the remembered state — changing it forgets the preference. */
  id: string
  icon?: LucideIcon
  title: ReactNode
  /** Counts or badges shown inline after the title. */
  meta?: ReactNode
  /** Right-hand summary, kept OUTSIDE the toggle so it can hold its own controls. */
  aside?: ReactNode
  defaultOpen?: boolean
  contentClassName?: string
  children: ReactNode
}) {
  const { open, toggle } = usePanelState(id, defaultOpen)
  const contentId = `panel-${useId().replace(/:/g, '')}`

  return (
    <Card>
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between space-y-0 pb-3',
          // With the body hidden the header IS the card, so drop the padding
          // that only existed to separate it from content that isn't there.
          !open && 'pb-4'
        )}
      >
        <PanelToggle open={open} onToggle={toggle} controls={contentId} icon={icon} title={title} meta={meta} />
        {aside && <div className="ml-3 shrink-0">{aside}</div>}
      </CardHeader>
      {open && (
        <CardContent id={contentId} className={contentClassName}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}
