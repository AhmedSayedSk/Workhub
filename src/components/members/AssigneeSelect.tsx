'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Member } from '@/types'
import { MemberAvatar } from './MemberAvatar'
import { Search, UserPlus } from 'lucide-react'

interface AssigneeSelectProps {
  members: Member[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AssigneeSelect({ members, selectedIds, onChange, trigger, open: controlledOpen, onOpenChange }: AssigneeSelectProps) {
  const [search, setSearch] = useState('')
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  // Guard: when opened externally (controlled), ignore the first outside interaction
  // because the dropdown menu closing causes a spurious pointer event.
  const justOpenedRef = useRef(false)
  const isControlled = controlledOpen !== undefined

  useEffect(() => {
    if (isControlled && open) {
      justOpenedRef.current = true
      const timer = setTimeout(() => { justOpenedRef.current = false }, 200)
      return () => clearTimeout(timer)
    }
  }, [isControlled, open])

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  )

  const toggleMember = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  const content = (
    <PopoverContent
      className="w-64 p-0"
      align="end"
      onClick={(e) => e.stopPropagation()}
      onOpenAutoFocus={(e) => {
        // In controlled mode, prevent Radix from stealing focus (which fails on hidden anchors)
        if (isControlled) e.preventDefault()
      }}
      onInteractOutside={(e) => {
        // Block the spurious outside event from the closing dropdown
        if (justOpenedRef.current) {
          e.preventDefault()
        }
      }}
    >
      <div className="flex items-center border-b px-3 py-2">
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <Input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      <ScrollArea className="max-h-[220px]">
        <div className="p-1">
          {filtered.map((member) => {
            const isSelected = selectedIds.includes(member.id)
            return (
              <button
                key={member.id}
                onClick={() => toggleMember(member.id)}
                className="flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={isSelected} className="pointer-events-none" />
                <MemberAvatar member={member} size="sm" />
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium truncate">{member.name}</div>
                  {member.role && (
                    <div className="text-xs text-muted-foreground truncate">{member.role}</div>
                  )}
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No members found
            </p>
          )}
        </div>
      </ScrollArea>
    </PopoverContent>
  )

  // Controlled mode: use PopoverAnchor (no click trigger needed)
  if (isControlled) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          {trigger || <span />}
        </PopoverAnchor>
        {content}
      </Popover>
    )
  }

  // Uncontrolled mode: use PopoverTrigger as before
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger || (
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        )}
      </PopoverTrigger>
      {content}
    </Popover>
  )
}
