'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'react-toastify'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { authFetch } from '@/lib/api-client'
import { renderJobs } from '@/lib/firestore'
import { ArrowLeft, CalendarClock, Loader2, Facebook, Instagram, Linkedin, AlertCircle, ImageOff } from 'lucide-react'
import type { Campaign, CampaignPost, RenderAspect, RenderJob } from '@/types'

function fmtSlot(ms: number | null): string {
  if (ms == null) return ''
  return new Date(ms).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function CampaignPreview({
  campaign,
  posts,
  slotFor,
  scheduling,
  onConfirm,
  onBack,
}: {
  campaign: Campaign
  posts: CampaignPost[]
  slotFor: (order: number) => number | null
  scheduling: boolean
  onConfirm: (includedIds: string[]) => void
  onBack: () => void
}) {
  // Schedulable = has an image and isn't already scheduled. Default all included.
  const rtl = campaign.language === 'ar'
  const schedulable = posts.filter((p) => p.imageUrl && p.status !== 'scheduled')

  // Warn if the campaign targets LinkedIn but the project isn't connected (posts would fail).
  const needsLinkedIn = campaign.platforms.includes('li')
  const [liConnected, setLiConnected] = useState<boolean | null>(null)
  useEffect(() => {
    if (!needsLinkedIn) return
    authFetch(`/api/social/linkedin/status?projectId=${campaign.projectId}`)
      .then((r) => r.json())
      .then((d) => setLiConnected(!!d.connected))
      .catch(() => setLiConnected(null))
  }, [needsLinkedIn, campaign.projectId])
  const [included, setIncluded] = useState<Set<string>>(() => new Set(schedulable.map((p) => p.id)))
  const toggle = (id: string) =>
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Campaign video render
  const [aspect, setAspect] = useState<RenderAspect>('portrait')
  const [videoJobId, setVideoJobId] = useState<string | null>(null)
  const [videoJob, setVideoJob] = useState<RenderJob | null>(null)
  useEffect(() => {
    if (!videoJobId) return
    return renderJobs.subscribe(videoJobId, setVideoJob)
  }, [videoJobId])
  // The render service pushes a webhook only when a job finishes; this poll
  // keeps the state moving in between and recovers a delivery that never
  // arrived. It mirrors onto the job document, so the subscription above still
  // delivers the update.
  const videoActive = videoJob?.status === 'queued' || videoJob?.status === 'rendering'
  useEffect(() => {
    if (!videoJobId || !videoActive) return
    const tick = () => { void authFetch(`/api/render-jobs/${videoJobId}/status`).catch(() => { /* next tick retries */ }) }
    tick()
    const t = setInterval(tick, 4000)
    return () => clearInterval(t)
  }, [videoJobId, videoActive])
  const [starting, setStarting] = useState(false)
  const generateVideo = async () => {
    setStarting(true)
    try {
      const res = await authFetch(`/api/campaigns/${campaign.id}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aspect }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not start video')
        return
      }
      setVideoJobId(data.jobId)
      setVideoJob(null)
    } finally {
      setStarting(false)
    }
  }
  const videoRendering = starting || videoActive

  const selectedSlots = schedulable
    .filter((p) => included.has(p.id))
    .map((p) => slotFor(p.order))
    .filter((s): s is number => s != null)
    .sort((a, b) => a - b)
  const range =
    selectedSlots.length > 0
      ? `${fmtSlot(selectedSlots[0])} → ${fmtSlot(selectedSlots[selectedSlots.length - 1])}`
      : '—'

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Edit
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold leading-tight">Preview &amp; schedule</h2>
          <p className="text-xs text-muted-foreground">
            {included.size} of {schedulable.length} selected · {campaign.platforms.map((p) => p.toUpperCase()).join(' · ')} · {range}
          </p>
        </div>
        <Button onClick={() => onConfirm([...included])} disabled={scheduling || included.size === 0}>
          {scheduling ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
          Schedule {included.size}
        </Button>
      </div>

      {needsLinkedIn && liConnected === false && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">LinkedIn isn&apos;t connected for this project — its posts will fail until you connect it.</span>
          <Button asChild size="sm" variant="outline" className="h-7">
            <Link href={`/projects/${campaign.projectId}?stage=market`}>Connect</Link>
          </Button>
        </div>
      )}

      {/* Campaign video */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
        <span className="text-sm font-medium">Campaign video</span>
        <select
          value={aspect}
          onChange={(e) => setAspect(e.target.value as RenderAspect)}
          className="rounded-md border bg-background px-2 py-1 text-sm"
        >
          <option value="portrait">Portrait 9:16</option>
          <option value="landscape">Landscape 16:9</option>
          <option value="square">Square 1:1</option>
        </select>
        <Button size="sm" onClick={generateVideo} disabled={videoRendering}>
          {videoRendering ? 'Rendering…' : 'Generate video'}
        </Button>
        {videoJob && (
          <span className="text-xs text-muted-foreground">
            {videoJob.status === 'queued' && 'Queued…'}
            {videoJob.status === 'rendering' && 'Rendering on the render server…'}
            {videoJob.status === 'failed' && <span className="text-red-600">Failed: {videoJob.error}</span>}
            {videoJob.status === 'done' && 'Done'}
          </span>
        )}
        {videoJob?.status === 'done' && videoJob.videoUrl && (
          <div className="mt-2 w-full">
            <video src={videoJob.videoUrl} poster={videoJob.thumbnailUrl || undefined} controls className="max-h-[420px] rounded-lg" />
            <a href={videoJob.videoUrl} download className="mt-1 inline-block text-xs text-primary underline">
              Download
            </a>
          </div>
        )}
      </div>

      {/* Feed-style preview cards */}
      <div className="mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-2">
        {posts.map((post) => {
          const canSchedule = !!post.imageUrl && post.status !== 'scheduled'
          const isOn = included.has(post.id)
          const slot = slotFor(post.order)
          return (
            <div
              key={post.id}
              className={cn(
                'overflow-hidden rounded-xl border bg-card transition-all',
                canSchedule && !isOn && 'opacity-55',
                post.status === 'scheduled' && 'opacity-70'
              )}
            >
              {/* brand header */}
              <div className="flex items-center gap-2 px-3 py-2">
                {campaign.brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={campaign.brand.logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {campaign.brand.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{campaign.brand.name}</span>
                {campaign.platforms.includes('fb') && <Facebook className="h-3.5 w-3.5 text-muted-foreground" />}
                {campaign.platforms.includes('ig') && <Instagram className="h-3.5 w-3.5 text-muted-foreground" />}
                {campaign.platforms.includes('li') && <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>

              {/* image */}
              <div className="relative flex aspect-[4/5] items-center justify-center bg-muted">
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.thumbnailUrl || post.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImageOff className="h-7 w-7 opacity-40" />
                    <span className="text-[11px]">No image — generate first</span>
                  </div>
                )}
                {canSchedule && (
                  <button
                    onClick={() => toggle(post.id)}
                    className="absolute right-2 top-2 rounded-md bg-background/85 p-1 backdrop-blur-sm"
                    title={isOn ? 'Included' : 'Excluded'}
                  >
                    <Checkbox checked={isOn} className="pointer-events-none" />
                  </button>
                )}
              </div>

              {/* caption + meta */}
              <div className="space-y-1.5 p-3">
                <p dir={rtl ? 'rtl' : undefined} className={cn('whitespace-pre-wrap text-sm leading-relaxed', rtl && 'text-right')}>
                  {post.caption}
                </p>
                {post.hashtags.length > 0 && (
                  <p dir={rtl ? 'rtl' : undefined} className={cn('text-[11px] font-medium text-primary', rtl && 'text-right')}>
                    {post.hashtags.map((h) => `#${h}`).join(' ')}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {post.status === 'scheduled' ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Already scheduled</span>
                  ) : canSchedule ? (
                    <span>Posts {fmtSlot(slot)}</span>
                  ) : (
                    <span>Not schedulable</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
