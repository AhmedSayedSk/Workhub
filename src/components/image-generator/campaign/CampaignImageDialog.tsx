'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Loader2, RefreshCw, Download } from 'lucide-react'
import type { CampaignPost } from '@/types'

const ASPECT_LABEL: Record<string, string> = {
  portrait: 'Portrait (4:5)',
  square: 'Square (1:1)',
  landscape: 'Landscape (16:9)',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
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
  const [prompt, setPrompt] = useState(post.imagePrompt)
  useEffect(() => setPrompt(post.imagePrompt), [post.imagePrompt])

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
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Post #{index + 1} image</DialogTitle>
        <div className="grid md:grid-cols-[1fr_300px]">
          {/* Full image */}
          <div className="flex max-h-[82vh] min-h-[300px] items-center justify-center bg-black/90 p-2">
            {post.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.imageUrl}
                alt=""
                onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                className="max-h-[80vh] w-auto object-contain"
              />
            ) : (
              <p className="py-20 text-sm text-white/60">No image generated yet</p>
            )}
          </div>

          {/* Details */}
          <div className="flex max-h-[82vh] flex-col gap-3 overflow-y-auto p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Post #{index + 1}</h3>
              <Badge variant="outline" className="text-[10px] capitalize">{post.status}</Badge>
            </div>

            <div className="space-y-1.5 text-xs">
              <Row label="Dimensions" value={dims ? `${dims.w} × ${dims.h} px` : '—'} />
              <Row label="Aspect" value={ASPECT_LABEL[post.aspect] || post.aspect} />
              <Row label="Model" value="nano-banana-pro" />
              {scheduledMs && <Row label="Scheduled" value={new Date(scheduledMs).toLocaleString()} />}
            </div>

            <Separator />

            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Caption</p>
              <p dir={rtl ? 'rtl' : undefined} className={cn('whitespace-pre-wrap text-xs leading-relaxed', rtl && 'text-right')}>
                {post.caption}
              </p>
              {post.hashtags.length > 0 && (
                <p dir={rtl ? 'rtl' : undefined} className={cn('mt-1 text-[11px] font-medium text-primary', rtl && 'text-right')}>
                  {post.hashtags.map((h) => `#${h}`).join(' ')}
                </p>
              )}
            </div>

            <div>
              <p className="mb-1 text-[11px] font-medium text-muted-foreground">Image prompt</p>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onBlur={() => prompt !== post.imagePrompt && onChange({ imagePrompt: prompt })}
                rows={5}
                disabled={post.status === 'scheduled'}
                className="resize-none text-xs leading-relaxed"
              />
            </div>

            <div className="mt-auto flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
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
