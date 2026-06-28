'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Loader2, Facebook, Instagram, Linkedin } from 'lucide-react'
import type { SocialPost, SocialPlatform } from '@/types'

const PLATFORM_META: {
  value: SocialPlatform
  label: string
  Icon: typeof Facebook
  idKey: 'fbPostId' | 'igMediaId' | 'liPostId'
  note?: string
}[] = [
  { value: 'fb', label: 'Facebook', Icon: Facebook, idKey: 'fbPostId' },
  { value: 'ig', label: 'Instagram', Icon: Instagram, idKey: 'igMediaId', note: "API can't delete Instagram media — remove it in the app" },
  { value: 'li', label: 'LinkedIn', Icon: Linkedin, idKey: 'liPostId' },
]

/** Pick which platforms to delete an already-published post from. */
export function RemoveFromPlatformsDialog({
  post,
  open,
  onOpenChange,
  onDone,
}: {
  post: SocialPost | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}) {
  const live = post ? PLATFORM_META.filter((p) => !!post[p.idKey]) : []
  const [selected, setSelected] = useState<Set<SocialPlatform>>(new Set())
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Record<string, string> | null>(null)

  useEffect(() => {
    if (post) {
      setSelected(new Set(PLATFORM_META.filter((p) => !!post[p.idKey]).map((p) => p.value)))
      setResults(null)
    }
  }, [post])

  const toggle = (p: SocialPlatform) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(p)) n.delete(p)
      else n.add(p)
      return n
    })

  async function handleRemove() {
    if (!post || selected.size === 0) return
    setBusy(true)
    setResults(null)
    try {
      const res = await authFetch('/api/social/unpublish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, platforms: [...selected] }),
      })
      const data = await res.json().catch(() => ({}))
      setResults(data.results || {})
      onDone()
      const clean = Object.values(data.results || {}).every((v) => v === 'removed')
      if (res.ok && clean) onOpenChange(false)
    } catch {
      setResults({ _: 'Request failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remove from platforms</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Delete this published post from the selected platforms.</p>

        <div className="space-y-2">
          {live.length === 0 && <p className="text-sm text-muted-foreground">This post isn&apos;t live on any platform.</p>}
          {live.map(({ value, label, Icon, note }) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5">
              <Checkbox checked={selected.has(value)} onCheckedChange={() => toggle(value)} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="h-4 w-4" /> {label}
                </span>
                {note && <span className="block text-[11px] text-amber-600 dark:text-amber-400">{note}</span>}
                {results?.[value] && (
                  <span className={cn('block text-[11px]', results[value] === 'removed' ? 'text-emerald-600' : 'text-destructive')}>
                    {results[value]}
                  </span>
                )}
              </div>
            </label>
          ))}
          {results?._ && <p className="text-xs text-destructive">{results._}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button variant="destructive" onClick={handleRemove} disabled={busy || selected.size === 0}>
            {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
