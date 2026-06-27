'use client'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2, ImageIcon, RefreshCw, Sparkles, FileText } from 'lucide-react'
import { CampaignImageDialog } from './CampaignImageDialog'
import type { CampaignPost } from '@/types'

export function CampaignPostCard({
  post,
  index,
  generating,
  rtl = false,
  onChange,
  onGenerateImage,
}: {
  post: CampaignPost
  index: number
  generating: boolean
  rtl?: boolean
  onChange: (patch: Partial<CampaignPost>) => void
  onGenerateImage: () => void
}) {
  const [caption, setCaption] = useState(post.caption)
  useEffect(() => setCaption(post.caption), [post.caption])
  const [dialogOpen, setDialogOpen] = useState(false)

  const scheduled = post.status === 'scheduled'

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="group relative flex h-52 items-center justify-center bg-muted">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            onClick={() => setDialogOpen(true)}
            className="h-full w-full cursor-zoom-in object-contain"
          />
        ) : generating ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ImageIcon className="h-8 w-8 cursor-pointer text-muted-foreground/40" onClick={() => setDialogOpen(true)} />
        )}

        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          #{index + 1}
        </span>
        {scheduled && (
          <Badge className="absolute bottom-2 left-2 border-0 bg-emerald-500 text-[10px] text-white">Scheduled</Badge>
        )}

        {/* Floating actions (top-right) */}
        <div className="absolute right-2 top-2 flex gap-1">
          {!scheduled && (
            <button
              onClick={onGenerateImage}
              disabled={generating}
              title={post.imageUrl ? 'Regenerate image' : 'Generate image'}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : post.imageUrl ? (
                <RefreshCw className="h-3.5 w-3.5" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          <button
            onClick={() => setDialogOpen(true)}
            title="Image prompt & details"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Caption + hashtags */}
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== post.caption && onChange({ caption })}
          rows={3}
          dir={rtl ? 'rtl' : undefined}
          disabled={scheduled}
          className={cn('resize-none text-sm leading-relaxed', rtl && 'text-right')}
          placeholder="Caption"
        />
        {post.hashtags.length > 0 && (
          <div dir={rtl ? 'rtl' : undefined} className={cn('flex flex-wrap gap-x-1.5 gap-y-0.5', rtl && 'justify-end')}>
            {post.hashtags.map((h) => (
              <span key={h} className="text-[11px] font-medium text-primary">#{h}</span>
            ))}
          </div>
        )}
      </div>

      <CampaignImageDialog
        post={post}
        index={index}
        rtl={rtl}
        generating={generating}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onChange={onChange}
        onGenerate={onGenerateImage}
      />
    </div>
  )
}
