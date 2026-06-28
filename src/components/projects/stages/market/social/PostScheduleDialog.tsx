'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import type { SocialPost, SocialPlatform } from '@/types'

// Build a <input type="datetime-local"> value from a ms timestamp (local tz).
function toLocalInput(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
]

const SHIFTS = [
  { label: '+1 hour', ms: 3_600_000 },
  { label: '+1 day', ms: 86_400_000 },
  { label: '+1 week', ms: 7 * 86_400_000 },
]

/** Reschedule + edit an existing scheduled (or draft/failed) post via PATCH /api/social/schedule. */
export function PostScheduleDialog({
  post,
  open,
  onOpenChange,
  onSaved,
}: {
  post: SocialPost | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const [caption, setCaption] = useState('')
  const [when, setWhen] = useState('')
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!post) return
    setCaption(post.caption || '')
    const ms = post.scheduledAt
      ? (post.scheduledAt as unknown as { toMillis: () => number }).toMillis()
      : Date.now() + 3_600_000
    setWhen(toLocalInput(ms))
    setPlatforms(post.platforms || [])
    setError(null)
  }, [post])

  const shift = (deltaMs: number) => {
    const base = when ? new Date(when).getTime() : Date.now()
    setWhen(toLocalInput(base + deltaMs))
  }
  const togglePlatform = (p: SocialPlatform) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))

  async function handleSave() {
    if (!post) return
    setError(null)
    const ms = new Date(when).getTime()
    if (Number.isNaN(ms) || ms <= Date.now()) {
      setError('Pick a future date & time')
      return
    }
    if (platforms.length === 0) {
      setError('Select at least one platform')
      return
    }
    if (platforms.includes('ig') && (post.mediaType === 'none' || !post.mediaUrls?.[0])) {
      setError('Instagram requires an image or video')
      return
    }
    setSaving(true)
    try {
      const res = await authFetch('/api/social/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, caption, scheduledAt: ms, platforms }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Could not save')
        return
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule &amp; edit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Caption</Label>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={4} className="resize-none" placeholder="Caption" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Date &amp; time</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SHIFTS.map((q) => (
                <Button key={q.label} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => shift(q.ms)}>
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Platforms</Label>
            <div className="flex gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => togglePlatform(p.value)}
                  className={cn(
                    'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                    platforms.includes(p.value) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
