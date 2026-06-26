'use client'

import { useMemo, useState } from 'react'
import { useProjects } from '@/hooks/useProjects'
import { useCampaigns } from '@/hooks/useCampaigns'
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
import { cn } from '@/lib/utils'
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
} from 'lucide-react'
import { CampaignPostCard } from './CampaignPostCard'
import { authFetch } from '@/lib/api-client'
import { toast } from 'react-toastify'
import type { CampaignLanguage, SocialPlatform } from '@/types'

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
]

export function CampaignTab() {
  const { projects } = useProjects()
  const [projectId, setProjectId] = useState<string | null>(null)
  const c = useCampaigns(projectId)
  const project = useMemo(() => projects.find((p) => p.id === projectId) || null, [projects, projectId])

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

  // Project context fed to the AI for both the brief suggestion and the plan.
  const buildContext = () =>
    project
      ? [
          project.name,
          project.description,
          project.projectType ? `Type: ${project.projectType}` : '',
          project.clientName ? `Client: ${project.clientName}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      : ''

  const [suggesting, setSuggesting] = useState(false)
  const handleSuggest = async () => {
    if (!project) return
    setSuggesting(true)
    try {
      const res = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'campaign_brief', data: { context: buildContext() } }),
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
    await c.createCampaign({
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
  }

  const handlePlan = () => {
    if (!project) return
    c.generatePlan(buildContext())
  }

  // ── Active campaign view ──────────────────────────────────────────────────
  if (c.activeCampaign) {
    const cam = c.activeCampaign
    const readyCount = c.posts.filter((p) => p.imageUrl).length
    const scheduledCount = c.posts.filter((p) => p.status === 'scheduled').length
    return (
      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => c.selectCampaign(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Campaigns
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold leading-tight">{cam.name}</h2>
            <p className="text-xs text-muted-foreground">
              {cam.platforms.map((p) => p.toUpperCase()).join(' · ')} · {cam.language.toUpperCase()} ·{' '}
              {c.posts.length} posts
            </p>
          </div>
          <Badge variant="outline" className="capitalize">{cam.status}</Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => c.deleteCampaign(cam.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {c.posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
              <Wand2 className="h-7 w-7 text-primary/60" />
            </div>
            <p className="text-sm text-muted-foreground">Generate {cam.brief.count} branded posts from this brief.</p>
            <Button onClick={handlePlan} disabled={c.planning}>
              {c.planning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {c.planning ? 'Planning…' : 'Generate plan'}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handlePlan} disabled={c.planning}>
                {c.planning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />}
                Re-plan
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={c.generateAllImages}
                disabled={c.imagePostIds.size > 0 || readyCount === c.posts.length}
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
              <Button size="sm" onClick={c.scheduleAll} disabled={c.schedulingAll || readyCount === 0}>
                {c.schedulingAll ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="mr-1.5 h-4 w-4" />
                )}
                Schedule all
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {c.posts.map((post, i) => (
                <CampaignPostCard
                  key={post.id}
                  post={post}
                  index={i}
                  generating={c.imagePostIds.has(post.id)}
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

  // ── Setup view (pick project → brief → existing campaigns) ────────────────
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 overflow-y-auto p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Project</Label>
        <Select value={projectId ?? undefined} onValueChange={(v) => setProjectId(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a project to build a campaign for" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!project ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted/40">
            <Megaphone className="h-7 w-7 text-primary/60" />
          </div>
          <p className="text-sm">Pick a project to plan a branded social campaign.</p>
        </div>
      ) : (
        <>
          {c.campaigns.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Existing campaigns</Label>
              <div className="flex flex-wrap gap-2">
                {c.campaigns.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => c.selectCampaign(cam.id)}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted"
                  >
                    <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{cam.name}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{cam.status}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New campaign brief */}
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">New campaign</h3>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleSuggest}
                disabled={suggesting}
                title="Read the project and propose the brief"
              >
                {suggesting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 h-3 w-3" />
                )}
                Suggest with AI
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Campaign name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={`${project.name} Campaign`}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Goal</Label>
                <Textarea
                  value={form.goal}
                  onChange={(e) => set('goal', e.target.value)}
                  rows={2}
                  className="resize-none"
                  placeholder="e.g. drive signups for the new launch; build awareness in the GCC market"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Audience</Label>
                <Input
                  value={form.audience}
                  onChange={(e) => set('audience', e.target.value)}
                  placeholder="who it's for"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tone</Label>
                <Input value={form.tone} onChange={(e) => set('tone', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Number of posts</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={form.count}
                  onChange={(e) => set('count', Number(e.target.value))}
                />
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
                <Input
                  type="number"
                  min={1}
                  value={form.cadenceDays}
                  onChange={(e) => set('cadenceDays', Number(e.target.value))}
                />
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
                        form.platforms.includes(p.value)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
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
        </>
      )}
    </div>
  )
}
