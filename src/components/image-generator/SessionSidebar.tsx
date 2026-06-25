'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, MoreVertical, Pencil, Trash2, Layers } from 'lucide-react'
import type { ImageGenSession } from '@/types'

interface SessionSidebarProps {
  sessions: ImageGenSession[]
  activeSessionId: string | null
  counts: Record<string, number>
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, name: string) => void
  onDelete: (session: ImageGenSession) => void
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  counts,
  onSelect,
  onNew,
  onRename,
  onDelete,
}: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startRename = (s: ImageGenSession) => {
    setEditingId(s.id)
    setDraft(s.name)
  }
  const commitRename = () => {
    if (editingId) {
      const name = draft.trim()
      if (name) onRename(editingId, name)
    }
    setEditingId(null)
  }

  return (
    <aside className="flex h-full w-56 flex-shrink-0 flex-col border-r bg-muted/20">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Sessions
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNew} title="New session">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No sessions yet.</p>
        )}
        {sessions.map((s) => {
          const active = s.id === activeSessionId
          if (editingId === s.id) {
            return (
              <Input
                key={s.id}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="h-8 text-sm"
              />
            )
          }
          return (
            <div
              key={s.id}
              className={cn(
                'group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors',
                active ? 'bg-background shadow-sm' : 'hover:bg-muted/60'
              )}
            >
              <button
                onClick={() => onSelect(s.id)}
                className={cn('min-w-0 flex-1 truncate text-left', active ? 'font-medium' : 'text-muted-foreground')}
                title={s.name}
              >
                {s.name}
              </button>
              {counts[s.id] > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">{counts[s.id]}</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                    aria-label="Session menu"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => startRename(s)}>
                    <Pencil className="mr-2 h-4 w-4" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(s)} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
