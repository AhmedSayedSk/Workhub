'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, ImageIcon, RefreshCw, Sparkles } from 'lucide-react'
import type { CampaignPost } from '@/types'

export function CampaignPostCard({
  post,
  index,
  generating,
  onChange,
  onGenerateImage,
}: {
  post: CampaignPost
  index: number
  generating: boolean
  onChange: (patch: Partial<CampaignPost>) => void
  onGenerateImage: () => void
}) {
  const [caption, setCaption] = useState(post.caption)
  const [prompt, setPrompt] = useState(post.imagePrompt)

  // Keep local fields in sync when the post is re-planned/regenerated upstream.
  useEffect(() => setCaption(post.caption), [post.caption])
  useEffect(() => setPrompt(post.imagePrompt), [post.imagePrompt])

  const scheduled = post.status === 'scheduled'

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative flex h-44 items-center justify-center bg-muted">
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : generating ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          #{index + 1}
        </span>
        {scheduled && (
          <Badge className="absolute right-2 top-2 border-0 bg-emerald-500 text-[10px] text-white">Scheduled</Badge>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== post.caption && onChange({ caption })}
          rows={2}
          disabled={scheduled}
          className="resize-none text-xs leading-relaxed"
          placeholder="Caption"
        />
        {post.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-x-1.5 gap-y-0.5">
            {post.hashtags.map((h) => (
              <span key={h} className="text-[10px] font-medium text-primary">#{h}</span>
            ))}
          </div>
        )}
        <details className="text-[11px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Image prompt</summary>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={() => prompt !== post.imagePrompt && onChange({ imagePrompt: prompt })}
            rows={3}
            disabled={scheduled}
            className="mt-1 resize-none text-[11px] leading-relaxed"
          />
        </details>

        <div className="mt-auto pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 w-full text-xs"
            onClick={onGenerateImage}
            disabled={generating || scheduled}
          >
            {generating ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : post.imageUrl ? (
              <RefreshCw className="mr-1 h-3 w-3" />
            ) : (
              <Sparkles className="mr-1 h-3 w-3" />
            )}
            {post.imageUrl ? 'Regenerate' : 'Generate image'}
          </Button>
        </div>
      </div>
    </div>
  )
}
