'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useCampaigns } from '@/hooks/useCampaigns'
import { projects as projectsApi } from '@/lib/firestore'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn, getUrlParam, setUrlParam } from '@/lib/utils'
import {
  Loader2,
  Megaphone,
  Wand2,
  CalendarClock,
  Trash2,
  ArrowLeft,
  Images,
  Plus,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { CampaignPostCard } from './CampaignPostCard'
import { CampaignPreview } from './CampaignPreview'
import { authFetch } from '@/lib/api-client'
import { toast } from 'react-toastify'
import type { Campaign, CampaignLanguage, SocialPlatform, Project } from '@/types'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
]

export function CampaignTab() {
  const { user } = useAuth()
  // All projects INCLUDING sub-projects (so campaigns can target a sub-project).
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    projectsApi.getAll(user?.uid).then(setProjects).catch(() => {})
  }, [user?.uid])
  const sortedProjects = [...projects].sort((a, b) => {
    const ap = a.parentProjectId ? 1 : 0
    const bp = b.parentProjectId ? 1 : 0
    if (ap !== bp) return ap - bp
    return a.name.localeCompare(b.name)
  })

  const [projectId, setProjectId] = useState<string | null>(null)
  const c = useCampaigns(projectId)
  const project = projects.find((p) => p.id === projectId) || null
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || 'Project'

  const [preview, setPreview] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

  // On load, reopen the campaign from the URL (?campaign=) so a refresh restores it.
  useEffect(() => {
    const id = getUrlParam('campaign')
    if (id) c.selectCampaign(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Navigation helpers keep ?campaign= in sync (explicit, race-free).
  const goToCampaign = (id: string | null) => {
    setPreview(false)
    setUrlParam('campaign', id)
    c.selectCampaign(id)
  }

  const [form, setForm] = useState({
    name: '',
    goal: '',
    audience: '',
    tone: 'confident, friendly, concrete',
    count: 6,
    language: 'en' as CampaignLanguage,
    platforms: ['fb', 'ig'] as SocialPlatform[],
    startDate: todayISO(),
    cadenceDays: 2,
    postTime: '18:00',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  const buildContext = (p: Project | null) =>
    p
      ? [p.name, p.description, p.projectType ? `Type: ${p.projectType}` : '', p.clientName ? `Client: ${p.clientName}` : '']
          .filter(Boolean)
          .join('\n')
      : ''

  const handleSuggest = async () => {
    if (!project) return
    setSuggesting(true)
    try {
      const res = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'campaign_brief', data: { context: buildContext(project) } }),
      })
      const json = await res.json()
      if (!json.success || !json.data?.brief) throw new Error(json.error || 'Could not suggest a brief')
      const b = json.data.brief
      setForm((f) => ({
        ...f,
        name: b.name || f.name,
        goal: b.goal || f.goal,
        audience: b.audience || f.audience,
        tone: b.tone || f.tone,
        language: b.language || f.language,
        count: b.count || f.count,
        cadenceDays: b.cadenceDays || f.cadenceDays,
      }))
      toast.success('Brief suggested from project')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to suggest brief')
    } finally {
      setSuggesting(false)
    }
  }

  const togglePlatform = (p: SocialPlatform) =>
    set('platforms', form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p])

  const handleCreate = async () => {
    if (!project) return
    setPreview(false)
    const camp = await c.createCampaign({
      name: form.name.trim() || `${project.name} Campaign`,
      brief: {
        goal: form.goal,
        audience: form.audience,
        tone: form.tone,
        count: Math.max(1, Math.min(20, form.count)),
        startDate: form.startDate,
        cadenceDays: Math.max(1, form.cadenceDays),
        postTime: form.postTime,
      },
      brand: {
        name: project.name,
        colors: project.color ? [project.color] : [],
        logoUrl: project.coverImageUrl || null,
      },
      language: form.language,
      platforms: form.platforms.length ? form.platforms : ['fb', 'ig'],
    })
    if (camp) setUrlParam('campaign', camp.id)
  }

  const openAny = (camp: Campaign) => goToCampaign(camp.id)

  // ── Preview & schedule ────────────────────────────────────────────────────
  if (c.activeCampaign && preview) {
    return (
      <CampaignPreview
        campaign={c.activeCampaign}
        posts={c.posts}
        slotFor={c.slotFor}
        scheduling={c.schedulingAll}
        onBack={() => setPreview(false)}
        onConfirm={async (ids) => {
          await c.scheduleAll(ids)
          setPreview(false)
        }}
      />
    )
  }

  // ── Active campaign view ──────────────────────────────────────────────────
  if (c.activeCampaign) {
    const cam = c.activeCampaign
    const readyCount = c.posts.filter((p) => p.imageUrl).length
    const scheduledCount = c.posts.filter((p) => p.status === 'scheduled').length
    return (
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => goToCampaign(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Campaigns
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold leading-tight">{cam.name}</h2>
            <p className="text-xs text-muted-foreground">
              {projectName(cam.projectId)} · {cam.platforms.map((p) => p.toUpperCase()).join(' · ')} ·{' '}
              {cam.language.toUpperCase()} · {c.posts.length} posts
            </p>
          </div>
          <Badge variant="outline" className="capitalize">{cam.status === 'planning' ? 'Planning…' : cam.status}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => { c.deleteCampaign(cam.id); setUrlParam('campaign', null) }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {c.planning ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Planning in the background…</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Generating {cam.brief.count} posts. You can leave this page or switch tabs — it keeps running and will
              be here when you come back.
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
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={c.generatePlan}>
                <Wand2 className="mr-1.5 h-4 w-4" /> Re-plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={c.generateAllImages}
                disabled={c.imagePostIds.size > 0 || c.posts.every((p) => p.status === 'scheduled')}
              >
                {c.imagePostIds.size > 0 ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Images className="mr-1.5 h-4 w-4" />
                )}
                Generate all images
              </Button>
              <div className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {readyCount}/{c.posts.length} images · {scheduledCount} scheduled
              </span>
              <Button onClick={() => setPreview(true)} disabled={readyCount === 0}>
                <CalendarClock className="mr-1.5 h-4 w-4" /> Preview &amp; schedule
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {c.posts.map((post, i) => (
                <CampaignPostCard
                  key={post.id}
                  post={post}
                  index={i}
                  generating={c.imagePostIds.has(post.id)}
                  rtl={cam.language === 'ar'}
                  onChange={(patch) => c.updatePost(post.id, patch)}
                  onGenerateImage={() => c.generateImage(post)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Overview: all campaigns + create for any project ──────────────────────
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 overflow-y-auto p-4">
      {c.allCampaigns.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">All campaigns</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {c.allCampaigns.map((cam) => (
              <button
                key={cam.id}
                onClick={() => openAny(cam)}
                className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted"
              >
                {cam.status === 'planning' ? (
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
                ) : (
                  <Megaphone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cam.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {projectName(cam.projectId)} · {cam.postCount ?? 0} posts
                    {cam.scheduledCount ? ` · ${cam.scheduledCount} scheduled` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-[10px] capitalize">
                  {cam.status === 'planning' ? 'Planning…' : cam.status}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs">Project</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sortedProjects.map((p) => (
            <button
              key={p.id}
              onClick={() => setProjectId(p.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border bg-card p-2 text-left transition-colors hover:border-primary/40 hover:bg-muted',
                projectId === p.id && 'border-primary ring-1 ring-primary/30'
              )}
            >
              <ProjectIcon src={p.coverImageUrl} name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                {p.parentProjectId ? (
                  <p className="truncate text-[10px] text-muted-foreground">↳ {projectName(p.parentProjectId)}</p>
                ) : (
                  p.clientName && <p className="truncate text-[10px] text-muted-foreground">{p.clientName}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!project ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
            <Megaphone className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm">Pick a project to plan a new campaign, or open one above.</p>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">New campaign</h3>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSuggest} disabled={suggesting} title="Read the project and propose the brief">
              {suggesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Suggest with AI
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Campaign name</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={`${project.name} Campaign`} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Goal</Label>
              <Textarea value={form.goal} onChange={(e) => set('goal', e.target.value)} rows={2} className="resize-none" placeholder="e.g. drive signups for the new launch; build awareness in the GCC market" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Audience</Label>
              <Input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="who it's for" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tone</Label>
              <Input value={form.tone} onChange={(e) => set('tone', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Number of posts</Label>
              <Input type="number" min={1} max={20} value={form.count} onChange={(e) => set('count', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Language</Label>
              <Select value={form.language} onValueChange={(v) => set('language', v as CampaignLanguage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Post time</Label>
              <Input type="time" value={form.postTime} onChange={(e) => set('postTime', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Every N days</Label>
              <Input type="number" min={1} value={form.cadenceDays} onChange={(e) => set('cadenceDays', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Platforms</Label>
              <div className="flex gap-1.5">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => togglePlatform(p.value)}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                      form.platforms.includes(p.value) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={c.loading} className="w-full">
            <Megaphone className="mr-2 h-4 w-4" /> Create campaign
          </Button>
        </div>
      )}
    </div>
  )
}
