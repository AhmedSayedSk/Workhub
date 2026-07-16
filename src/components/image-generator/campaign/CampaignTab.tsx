'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { projects as projectsApi, renderJobs } from '@/lib/firestore'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, getUrlParam, setUrlParam } from '@/lib/utils'
import Link from 'next/link'
import { Loader2, Megaphone, Wand2, CalendarClock, Trash2, ArrowLeft, Images, Plus, AlertCircle, ImageIcon, ExternalLink, MoreVertical } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { CampaignPostCard } from './CampaignPostCard'
import { CampaignImageDialog } from './CampaignImageDialog'
import { CampaignCreateDialog } from './CampaignCreateDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { authFetch } from '@/lib/api-client'
import { CAMPAIGN_STYLES } from '@/lib/campaignStyles'
import { toast } from 'react-toastify'
import type { Project, RenderAspect, RenderJob } from '@/types'

export function CampaignTab() {
  const { user } = useAuth()
  const c = useCampaigns()
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    projectsApi.getAll(user?.uid).then(setProjects).catch(() => {})
  }, [user?.uid])
  const projectOf = (id: string) => projects.find((p) => p.id === id) || null
  const projectName = (id: string) => projectOf(id)?.name || 'Project'
  const styleLabel = (key?: string) => CAMPAIGN_STYLES.find((s) => s.key === key)?.label

  const [scheduleMode, setScheduleMode] = useState(false)
  // Campaign video render — track the LATEST job for the active campaign so the
  // progress/state survives a page refresh (reconnects instead of resetting).
  const [videoAspect, setVideoAspect] = useState<RenderAspect>('portrait')
  const [videoJob, setVideoJob] = useState<RenderJob | null>(null)
  const [videoStarting, setVideoStarting] = useState(false)
  const activeCampaignId = c.activeCampaign?.id ?? null
  useEffect(() => {
    setVideoJob(null)
    if (!activeCampaignId) return
    return renderJobs.subscribeLatestForCampaign(activeCampaignId, setVideoJob)
  }, [activeCampaignId])
  const VIDEO_STAGE: Record<string, string> = {
    preparing: 'Preparing…',
    hook: 'Generating hook image…',
    rendering: 'Rendering scenes…',
    encoding: 'Encoding video…',
    uploading: 'Uploading…',
  }
  const activeVideo = videoJob?.status === 'queued' || videoJob?.status === 'rendering'
  const videoRendering = videoStarting || activeVideo
  const videoPct = activeVideo ? Math.min(100, Math.max(0, videoJob?.progress ?? 0)) : 0
  const videoStageLabel = !activeVideo
    ? 'Starting…'
    : videoJob?.status === 'queued'
      ? 'Queued…'
      : VIDEO_STAGE[videoJob?.stage || ''] || 'Rendering…'
  const generateVideo = async () => {
    const id = c.activeCampaign?.id
    if (!id) return
    setVideoStarting(true)
    setVideoJob(null)
    try {
      const res = await authFetch(`/api/campaigns/${id}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ aspect: videoAspect }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Could not start video'); return }
    } finally {
      setVideoStarting(false)
    }
  }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewIndex, setViewIndex] = useState<number | null>(null)

  // Reopen the campaign from the URL on load.
  useEffect(() => {
    const id = getUrlParam('campaign')
    if (id) c.selectCampaign(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // LinkedIn connection status (for the schedule guard) when the active campaign targets it.
  const activeNeedsLi = c.activeCampaign?.platforms.includes('li')
  const activeProjectId = c.activeCampaign?.projectId
  const [liConnected, setLiConnected] = useState<boolean | null>(null)
  useEffect(() => {
    if (!activeNeedsLi || !activeProjectId) {
      setLiConnected(null)
      return
    }
    authFetch(`/api/social/linkedin/status?projectId=${activeProjectId}`)
      .then((r) => r.json())
      .then((d) => setLiConnected(!!d.connected))
      .catch(() => setLiConnected(null))
  }, [activeNeedsLi, activeProjectId])

  const goToCampaign = (id: string | null) => {
    setScheduleMode(false)
    setSelected(new Set())
    setUrlParam('campaign', id)
    c.selectCampaign(id)
  }

  // ── Active campaign view ──────────────────────────────────────────────────
  if (c.activeCampaign) {
    const cam = c.activeCampaign
    const readyCount = c.posts.filter((p) => p.imageUrl).length
    const scheduledCount = c.posts.filter((p) => p.status === 'scheduled').length
    const schedulable = c.posts.filter((p) => p.imageUrl && p.status !== 'scheduled')
    const fmtSlot = (ms: number | null) =>
      ms == null ? '' : new Date(ms).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const selectedSlots = schedulable
      .filter((p) => selected.has(p.id))
      .map((p) => c.slotFor(p.order))
      .filter((s): s is number => s != null)
      .sort((a, b) => a - b)
    const scheduleRange = selectedSlots.length ? `${fmtSlot(selectedSlots[0])} → ${fmtSlot(selectedSlots[selectedSlots.length - 1])}` : '—'
    const enterSchedule = () => {
      setSelected(new Set(schedulable.map((p) => p.id)))
      setScheduleMode(true)
    }
    const exitSchedule = () => {
      setScheduleMode(false)
      setSelected(new Set())
    }
    const toggleSelect = (id: string) =>
      setSelected((prev) => {
        const n = new Set(prev)
        if (n.has(id)) n.delete(id)
        else n.add(id)
        return n
      })
    const confirmSchedule = async () => {
      await c.scheduleAll([...selected])
      exitSchedule()
    }
    return (
      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => goToCampaign(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Campaigns
          </Button>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold leading-tight">{cam.name}</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              {projectName(cam.projectId)} · {cam.platforms.map((p) => p.toUpperCase()).join('·')} · {c.posts.length} posts
              {c.posts.length > 0 && ` · ${readyCount} generated · ${scheduledCount} scheduled`}
            </p>
          </div>
          <Badge variant="outline" className="capitalize">{cam.status === 'planning' ? 'Planning…' : cam.status}</Badge>
          <div className="flex-1" />
          {!scheduleMode && (
            <>
              {!c.planning && c.posts.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={c.generateAllImages}
                    disabled={c.imagePostIds.size > 0 || c.posts.every((p) => p.status === 'scheduled')}
                  >
                    {c.imagePostIds.size > 0 ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Images className="mr-1.5 h-4 w-4" />}
                    Generate all
                  </Button>
                  <Button size="sm" onClick={enterSchedule} disabled={readyCount === 0}>
                    <CalendarClock className="mr-1.5 h-4 w-4" /> Schedule
                  </Button>
                </>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" title="More actions">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!c.planning && c.posts.length > 0 && (
                    <DropdownMenuItem onClick={c.generatePlan}>
                      <Wand2 className="mr-2 h-4 w-4" /> Re-plan
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${cam.projectId}?stage=market`}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Open in Market
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete campaign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {scheduleMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-primary/5 px-3 py-2">
            <span className="text-sm font-medium">Select posts to schedule</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {selected.size}/{schedulable.length} · {scheduleRange}
            </span>
            {activeNeedsLi && liConnected === false && (
              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> LinkedIn not connected
              </span>
            )}
            <div className="flex-1" />
            <Button variant="ghost" size="sm" onClick={exitSchedule}>
              Cancel
            </Button>
            <Button size="sm" onClick={confirmSchedule} disabled={selected.size === 0 || c.schedulingAll}>
              {c.schedulingAll ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CalendarClock className="mr-1.5 h-4 w-4" />}
              Schedule {selected.size}
            </Button>
          </div>
        )}

        {!scheduleMode && readyCount > 0 && (
          <div className="space-y-2.5 rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Campaign video</span>
              <select
                value={videoAspect}
                onChange={(e) => setVideoAspect(e.target.value as RenderAspect)}
                disabled={videoRendering}
                className="rounded-md border bg-background px-2 py-1 text-sm disabled:opacity-60"
              >
                <option value="portrait">Portrait 9:16</option>
                <option value="landscape">Landscape 16:9</option>
                <option value="square">Square 1:1</option>
              </select>
              <Button size="sm" onClick={generateVideo} disabled={videoRendering}>
                {videoRendering ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Rendering…</>
                ) : videoJob?.status === 'done' ? 'Regenerate' : 'Generate video'}
              </Button>
              {!videoStarting && videoJob?.status === 'failed' && (
                <span className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle className="h-3.5 w-3.5" /> {videoJob.error || 'Render failed'}
                </span>
              )}
              {!videoStarting && videoJob?.status === 'done' && (
                <span className="text-xs font-medium text-emerald-600">Ready</span>
              )}
            </div>

            {videoRendering && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{videoStageLabel}</span>
                  <span className="font-medium tabular-nums text-muted-foreground">{videoPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(4, videoPct)}%` }}
                  />
                </div>
              </div>
            )}

            {!videoStarting && videoJob?.status === 'done' && videoJob.videoUrl && (
              <div className="pt-1">
                <video
                  src={videoJob.videoUrl}
                  poster={videoJob.thumbnailUrl || undefined}
                  controls
                  className="max-h-[440px] rounded-lg border"
                />
                <a href={videoJob.videoUrl} download className="mt-1 inline-block text-xs text-primary underline">
                  Download video
                </a>
              </div>
            )}
          </div>
        )}

        {c.planning ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Planning in the background…</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Generating {cam.brief.count} posts. You can leave this page or switch tabs — it keeps running.
            </p>
          </div>
        ) : c.posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
              <Wand2 className="h-7 w-7 text-primary/60" />
            </div>
            {cam.planError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" /> {cam.planError}
              </p>
            )}
            <p className="text-sm text-muted-foreground">Generate {cam.brief.count} branded posts from this brief.</p>
            <Button onClick={c.generatePlan}>
              <Wand2 className="mr-2 h-4 w-4" /> Generate plan
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {c.posts.map((post, i) => (
              <CampaignPostCard
                key={post.id}
                post={post}
                index={i}
                generating={c.imagePostIds.has(post.id)}
                rtl={cam.language === 'ar'}
                error={c.imageErrors[post.id]}
                onChange={(patch) => c.updatePost(post.id, patch)}
                onGenerateImage={() => c.generateImage(post)}
                onOpen={() => setViewIndex(i)}
                selectMode={scheduleMode}
                selected={selected.has(post.id)}
                onSelect={scheduleMode && post.imageUrl && post.status !== 'scheduled' ? () => toggleSelect(post.id) : undefined}
                slotLabel={scheduleMode && post.imageUrl && post.status !== 'scheduled' ? fmtSlot(c.slotFor(post.order)) : undefined}
              />
            ))}
          </div>
        )}

        {viewIndex !== null && c.posts[viewIndex] && (
          <CampaignImageDialog
            post={c.posts[viewIndex]}
            index={viewIndex}
            rtl={cam.language === 'ar'}
            generating={c.imagePostIds.has(c.posts[viewIndex].id)}
            open
            onOpenChange={(o) => !o && setViewIndex(null)}
            onChange={(patch) => c.updatePost(c.posts[viewIndex].id, patch)}
            onGenerate={() => c.generateImage(c.posts[viewIndex])}
            onPrev={viewIndex > 0 ? () => setViewIndex(viewIndex - 1) : undefined}
            onNext={viewIndex < c.posts.length - 1 ? () => setViewIndex(viewIndex + 1) : undefined}
          />
        )}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete campaign?"
          description="This permanently deletes the campaign and all its posts. This can’t be undone."
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            c.deleteCampaign(cam.id)
            setUrlParam('campaign', null)
            setConfirmDelete(false)
          }}
        />
      </div>
    )
  }

  // ── Overview: all campaigns (full width) + create modal ───────────────────
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Campaigns <span className="text-muted-foreground">({c.allCampaigns.length})</span></h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New campaign
        </Button>
      </div>

      {c.allCampaigns.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
            <Megaphone className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm">No campaigns yet. Create one for any project.</p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {c.allCampaigns.map((cam) => {
            const thumbs = c.postThumbs[cam.id] || []
            const proj = projectOf(cam.projectId)
            return (
              <button
                key={cam.id}
                onClick={() => goToCampaign(cam.id)}
                className="group overflow-hidden rounded-xl border bg-card text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                {/* Generated-image preview */}
                <div className="relative grid aspect-[16/9] grid-cols-3 gap-px bg-muted">
                  {styleLabel(cam.style) && (
                    <span className="absolute left-1.5 top-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                      {styleLabel(cam.style)}
                    </span>
                  )}
                  {thumbs.length > 0 ? (
                    [0, 1, 2].map((i) =>
                      thumbs[i] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={i} src={thumbs[i]} alt="" loading="lazy" className="h-full w-full object-cover" />
                      ) : (
                        <div key={i} className="h-full w-full bg-muted/60" />
                      )
                    )
                  ) : (
                    <div className="col-span-3 flex items-center justify-center gap-1.5 text-muted-foreground">
                      {cam.status === 'planning' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-xs">Planning…</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-5 w-5 opacity-40" />
                          <span className="text-xs">No images yet</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-2 border-t p-2.5">
                  <ProjectIcon src={proj?.coverImageUrl} name={proj?.name || cam.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{cam.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {projectName(cam.projectId)} · {cam.postCount ?? 0} posts
                      {cam.scheduledCount ? ` · ${cam.scheduledCount} sched` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {cam.status === 'planning' ? 'Planning…' : cam.status}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <CampaignCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={async (pid, input) => {
          const camp = await c.createCampaign(pid, input)
          if (camp) setUrlParam('campaign', camp.id)
          return camp
        }}
      />
    </div>
  )
}
