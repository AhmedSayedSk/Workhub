'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Download, ZoomIn, ZoomOut } from 'lucide-react'
import type { CampaignPost } from '@/types'

const ASPECT_LABEL: Record<string, string> = {
  portrait: 'Portrait · 4:5',
  square: 'Square · 1:1',
  landscape: 'Landscape · 16:9',
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-muted/30 px-2.5 py-1.5', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
}

export function CampaignImageDialog({
  post,
  index,
  rtl,
  generating,
  open,
  onOpenChange,
  onChange,
  onGenerate,
}: {
  post: CampaignPost
  index: number
  rtl: boolean
  generating: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
  onChange: (patch: Partial<CampaignPost>) => void
  onGenerate: () => void
}) {
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [prompt, setPrompt] = useState(post.imagePrompt)
  useEffect(() => setPrompt(post.imagePrompt), [post.imagePrompt])
  useEffect(() => { if (!open) setZoomed(false) }, [open])

  const scheduledMs = post.scheduledAt?.toMillis?.() ?? null
  const download = () => {
    if (!post.imageUrl) return
    const a = document.createElement('a')
    a.href = post.imageUrl
    a.target = '_blank'
    a.rel = 'noreferrer'
    a.download = `post_${index + 1}.png`
    a.click()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[92vw] max-w-[92vw] gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Post #{index + 1} image</DialogTitle>
        <div className="grid h-full md:grid-cols-[1fr_360px]">
          {/* Full image (click or button to zoom; scroll when zoomed) */}
          <div className="relative flex h-full min-h-[320px] items-center justify-center overflow-auto bg-neutral-950 p-3">
            {post.imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl}
                  alt=""
                  onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  onClick={() => setZoomed((z) => !z)}
                  className={cn(
                    'rounded-md shadow-lg',
                    zoomed ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in object-contain'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  title={zoomed ? 'Fit to screen' : 'Zoom in (100%)'}
                  className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  {zoomed ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                </button>
              </>
            ) : (
              <p className="py-20 text-sm text-white/50">No image generated yet</p>
            )}
          </div>

          {/* Details */}
          <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-semibold leading-tight">Post #{index + 1}</h3>
                <p className="text-xs text-muted-foreground">Campaign post</p>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">{post.status}</Badge>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Dimensions" value={dims ? `${dims.w} × ${dims.h}` : '—'} />
              <Stat label="Aspect" value={ASPECT_LABEL[post.aspect] || post.aspect} />
              <Stat label="Model" value={post.model || 'nano-banana-pro'} />
              <Stat label="Order" value={`#${index + 1}`} />
              {scheduledMs && <Stat label="Scheduled" value={new Date(scheduledMs).toLocaleString()} className="col-span-2" />}
            </div>

            {/* Caption */}
            <section className="space-y-1.5">
              <SectionLabel>Caption</SectionLabel>
              <div className="rounded-lg bg-muted/40 p-3">
                <p
                  dir={rtl ? 'rtl' : undefined}
                  className={cn('whitespace-pre-wrap text-sm leading-relaxed', rtl && 'text-right')}
                >
                  {post.caption}
                </p>
                {post.hashtags.length > 0 && (
                  <p
                    dir={rtl ? 'rtl' : undefined}
                    className={cn('mt-2 text-xs font-medium leading-relaxed text-primary', rtl && 'text-right')}
                  >
                    {post.hashtags.map((h) => `#${h}`).join(' ')}
                  </p>
                )}
              </div>
            </section>

            {/* Image prompt */}
            <section className="space-y-1.5">
              <SectionLabel>Image prompt</SectionLabel>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onBlur={() => prompt !== post.imagePrompt && onChange({ imagePrompt: prompt })}
                rows={5}
                disabled={post.status === 'scheduled'}
                className="resize-none text-sm leading-relaxed"
              />
            </section>

            {/* Actions */}
            <div className="mt-auto flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                variant="outline"
                onClick={onGenerate}
                disabled={generating || post.status === 'scheduled'}
              >
                {generating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                )}
                {post.imageUrl ? 'Regenerate' : 'Generate'}
              </Button>
              {post.imageUrl && (
                <Button size="sm" variant="outline" onClick={download} title="Open / download full size">
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
