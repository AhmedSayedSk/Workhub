'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { projects as projectsApi, renderJobs } from '@/lib/firestore'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, getUrlParam, setUrlParam } from '@/lib/utils'
import Link from 'next/link'
import { Loader2, Megaphone, Wand2, CalendarClock, Trash2, ArrowLeft, Images, Plus, AlertCircle, ImageIcon, ExternalLink, MoreVertical, Play, Download } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { CampaignPostCard } from './CampaignPostCard'
import { CampaignImageDialog } from './CampaignImageDialog'
import { CampaignCreateDialog } from './CampaignCreateDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { authFetch } from '@/lib/api-client'
import { CAMPAIGN_STYLES } from '@/lib/campaignStyles'
import { toast } from 'react-toastify'
import type { Project, RenderAspect, RenderJob, CreativeScene } from '@/types'

const ASPECT_LABEL: Record<string, string> = { portrait: 'Portrait 9:16', landscape: 'Landscape 16:9', square: 'Square 1:1' }
const SCENE_BADGE: Record<string, string> = { hook: 'Hook', beat: 'Beat', stat: 'Stat', showcase: 'Image', cta: 'CTA' }
const VO_LANG_LABEL: Record<string, string> = { en: 'English', ar: 'العربية' }

function creativeSceneText(s: CreativeScene): string {
  switch (s.type) {
    case 'hook': return (s.headline || '').replace(/\n/g, ' ')
    case 'beat': return [s.title, s.sub].filter(Boolean).join(' — ')
    case 'stat': return [s.value, s.label].filter(Boolean).join('  ')
    case 'showcase': return [s.caption, s.sub].filter(Boolean).join(' — ')
    case 'cta': return s.text || ''
    default: return ''
  }
}

// Minimal segmented control used by the video-generation modal.
function Seg<T extends string>({ value, onChange, options, disabled }: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string }>
  disabled?: boolean
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border bg-muted/40 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-3 py-1.5 font-medium transition-colors disabled:opacity-50',
            value === o.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

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
  const [videoMode, setVideoMode] = useState<'basic' | 'creative'>('basic')
  const [voiceover, setVoiceover] = useState(false)
  const [voiceoverLang, setVoiceoverLang] = useState<'en' | 'ar'>('en')
  const [voiceoverGender, setVoiceoverGender] = useState<'female' | 'male'>('female')
  const [voiceoverModel, setVoiceoverModel] = useState<'standard' | 'premium'>('standard')
  const [voiceoverRate, setVoiceoverRate] = useState<'auto' | '1' | '1.1' | '1.25' | '1.5' | '0.9'>('auto')
  const [videoTransition, setVideoTransition] = useState<'smooth' | 'simple' | 'none'>('smooth')
  const [videoSfx, setVideoSfx] = useState(true)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [videoJob, setVideoJob] = useState<RenderJob | null>(null)
  const [videoStarting, setVideoStarting] = useState(false)
  const activeCampaignId = c.activeCampaign?.id ?? null
  useEffect(() => {
    setVideoJob(null)
    if (!activeCampaignId) return
    // Default the voiceover language to the campaign's own language.
    setVoiceoverLang(c.activeCampaign?.language === 'ar' ? 'ar' : 'en')
    return renderJobs.subscribeLatestForCampaign(activeCampaignId, setVideoJob)
  }, [activeCampaignId])
  const VIDEO_STAGE: Record<string, string> = {
    preparing: 'Preparing…',
    hook: 'Generating hook image…',
    voiceover: 'Recording voiceover…',
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
  const videoReady = !videoStarting && videoJob?.status === 'done' && !!videoJob?.videoUrl
  const generateVideo = async () => {
    const id = c.activeCampaign?.id
    if (!id) return
    setVideoStarting(true)
    setVideoJob(null)
    try {
      const res = await authFetch(`/api/campaigns/${id}/render`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          aspect: videoAspect,
          mode: videoMode,
          transition: videoTransition,
          sfx: { enabled: videoSfx },
          voiceover: voiceover ? { enabled: true, language: voiceoverLang, gender: voiceoverGender, model: voiceoverModel, rate: voiceoverRate === 'auto' ? 'auto' : Number(voiceoverRate) } : { enabled: false },
        }),
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
          <button
            type="button"
            onClick={() => setVideoModalOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
          >
            {videoJob?.status === 'done' && videoJob.thumbnailUrl ? (
              <span className="relative h-14 w-9 shrink-0 overflow-hidden rounded-md border">
                <img src={videoJob.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Play className="h-4 w-4 text-white" fill="currentColor" />
                </span>
              </span>
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                {videoRendering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Campaign video</span>
              <span className="block truncate text-xs text-muted-foreground">
                {videoRendering
                  ? `${videoStageLabel} ${videoPct}%`
                  : videoJob?.status === 'done'
                    ? 'Ready — tap to watch or regenerate'
                    : videoJob?.status === 'failed'
                      ? 'Last render failed — tap to retry'
                      : 'Turn this campaign into an animated reel'}
              </span>
            </span>
            {videoRendering ? (
              <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(6, videoPct)}%` }} />
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-primary">{videoJob?.status === 'done' ? 'Open' : 'Create'}</span>
            )}
          </button>
        )}

        <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
          <DialogContent className={cn('max-h-[92vh] overflow-y-auto', videoReady ? 'max-w-6xl' : 'max-w-md')}>
            <DialogHeader>
              <DialogTitle>Campaign video</DialogTitle>
            </DialogHeader>
            {(() => {
              const settings = (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Style</span>
                    <Seg
                      value={videoMode}
                      onChange={(m) => { setVideoMode(m); if (m === 'creative') setVideoAspect('portrait') }}
                      options={[{ value: 'creative' as const, label: 'Creative' }, { value: 'basic' as const, label: 'Basic' }]}
                      disabled={videoRendering}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Format</span>
                    {videoMode === 'creative' ? (
                      <span className="rounded-lg border bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">Portrait 9:16 · Reel</span>
                    ) : (
                      <Seg
                        value={videoAspect}
                        onChange={setVideoAspect}
                        options={[
                          { value: 'portrait' as const, label: '9:16' },
                          { value: 'landscape' as const, label: '16:9' },
                          { value: 'square' as const, label: '1:1' },
                        ]}
                        disabled={videoRendering}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Transitions</span>
                    <Seg
                      value={videoTransition}
                      onChange={setVideoTransition}
                      options={[
                        { value: 'smooth' as const, label: 'Smooth' },
                        { value: 'simple' as const, label: 'Simple' },
                        { value: 'none' as const, label: 'Cut' },
                      ]}
                      disabled={videoRendering}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground" title="Whooshes, pops, ticks and stings placed on the animations, mixed under the narration">Sound effects</span>
                    <Switch checked={videoSfx} onCheckedChange={setVideoSfx} disabled={videoRendering} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Voiceover</span>
                    <Switch checked={voiceover} onCheckedChange={setVoiceover} disabled={videoRendering} />
                  </div>
                  {voiceover && (
                    <div className="space-y-3 rounded-lg bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Language</span>
                        <Seg
                          value={voiceoverLang}
                          onChange={setVoiceoverLang}
                          options={[{ value: 'en' as const, label: 'English' }, { value: 'ar' as const, label: 'العربية' }]}
                          disabled={videoRendering}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Voice</span>
                        <Seg
                          value={voiceoverGender}
                          onChange={setVoiceoverGender}
                          options={[{ value: 'female' as const, label: 'Female' }, { value: 'male' as const, label: 'Male' }]}
                          disabled={videoRendering}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground">Quality</span>
                        <Seg
                          value={voiceoverModel}
                          onChange={setVoiceoverModel}
                          options={[{ value: 'standard' as const, label: 'Standard' }, { value: 'premium' as const, label: 'Premium' }]}
                          disabled={videoRendering}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-muted-foreground" title="Auto lets AI pick the pace from the campaign's tone, language and copy volume">Speed</span>
                        <Seg
                          value={voiceoverRate}
                          onChange={setVoiceoverRate}
                          options={[
                            { value: 'auto' as const, label: 'Auto' },
                            { value: '0.9' as const, label: '.9×' },
                            { value: '1' as const, label: '1×' },
                            { value: '1.1' as const, label: '1.1×' },
                            { value: '1.25' as const, label: '1.25×' },
                            { value: '1.5' as const, label: '1.5×' },
                          ]}
                          disabled={videoRendering}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
              const action = (
                <>
                  {videoRendering ? (
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {videoStageLabel}
                        </span>
                        <span className="font-medium tabular-nums text-muted-foreground">{videoPct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-700 ease-out" style={{ width: `${Math.max(4, videoPct)}%` }} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">You can close this — rendering continues in the background.</p>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={generateVideo}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      {videoJob?.status === 'done' ? 'Regenerate video' : 'Generate video'}
                    </Button>
                  )}
                  {!videoStarting && videoJob?.status === 'failed' && (
                    <p className="flex items-center gap-1.5 text-xs text-red-600">
                      <AlertCircle className="h-3.5 w-3.5" /> {videoJob.error || 'Render failed — try again'}
                    </p>
                  )}
                </>
              )

              if (!videoReady || !videoJob) {
                return <div className="space-y-5">{settings}{action}</div>
              }

              // Wide three-column layout once a video exists: player | settings
              // & actions | full-height "what went into this video" panel.
              return (
                <div className="grid gap-6 md:grid-cols-[300px_minmax(280px,340px)_minmax(0,1fr)]">
                  <div className="space-y-2">
                    <video
                      src={videoJob.videoUrl}
                      poster={videoJob.thumbnailUrl || undefined}
                      controls
                      className="w-full rounded-xl border bg-black"
                    />
                  </div>
                  <div className="space-y-5">
                    {settings}
                    {action}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="capitalize">{videoJob.mode || 'basic'}</Badge>
                        <Badge variant="secondary">{ASPECT_LABEL[videoJob.aspect] || videoJob.aspect}</Badge>
                        {videoJob.transition && videoJob.transition !== 'none' && (
                          <Badge variant="secondary" className="capitalize">{videoJob.transition} transitions</Badge>
                        )}
                        {videoJob.sfx?.enabled && <Badge variant="secondary">SFX</Badge>}
                        {videoJob.voiceover?.enabled && (
                          <Badge variant="secondary">
                            {VO_LANG_LABEL[videoJob.voiceover.language] || videoJob.voiceover.language} · {videoJob.voiceover.gender === 'male' ? 'Male' : 'Female'}{videoJob.voiceover.model === 'premium' ? ' · Premium' : ''}{videoJob.voiceover.rate && videoJob.voiceover.rate !== 1 ? ` · ${videoJob.voiceover.rate}×` : ''}{videoJob.voiceover.rateAuto ? ' (auto)' : ''}
                          </Badge>
                        )}
                      </div>
                      <a href={videoJob.videoUrl} download className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-muted/40">
                        <Download className="h-3.5 w-3.5" /> Download video
                      </a>
                    </div>
                  </div>
                  {((Array.isArray(videoJob.script) && videoJob.script.length > 0) || (Array.isArray(videoJob.scenes) && videoJob.scenes.length > 0)) ? (
                    <div className="flex min-h-0 flex-col rounded-lg border">
                      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">What went into this video</div>
                      <div className="max-h-[68vh] flex-1 space-y-2 overflow-y-auto p-3">
                        {Array.isArray(videoJob.script) && videoJob.script.length > 0 ? (
                          <ol className="space-y-2">
                            {videoJob.script.map((s, i) => (
                              <li key={i} className="flex items-start gap-2.5 rounded-md border p-2">
                                {s.type === 'showcase' && s.imageUrl ? (
                                  <img src={s.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded object-cover" />
                                ) : (
                                  <span className="mt-0.5 w-14 shrink-0 rounded bg-muted px-1.5 py-0.5 text-center text-[10px] font-semibold uppercase text-muted-foreground">{SCENE_BADGE[s.type] || s.type}</span>
                                )}
                                <span className="text-xs leading-relaxed">{creativeSceneText(s) || <span className="text-muted-foreground">—</span>}</span>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <div className="grid grid-cols-4 gap-2">
                            {(videoJob.scenes || []).map((s, i) => (
                              <img key={i} src={s.imageUrl} alt={s.headline || ''} title={s.caption || s.headline || ''} className="aspect-square w-full rounded border object-cover" />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : <div />}
                </div>
              )
            })()}
          </DialogContent>
        </Dialog>

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
