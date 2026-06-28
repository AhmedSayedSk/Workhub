'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { projects as projectsApi } from '@/lib/firestore'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { authFetch } from '@/lib/api-client'
import { toast } from 'react-toastify'
import { cn } from '@/lib/utils'
import { Loader2, Sparkles, Plus, Megaphone, RectangleHorizontal, RectangleVertical, Square } from 'lucide-react'
import { CAMPAIGN_STYLES, DEFAULT_CAMPAIGN_STYLE } from '@/lib/campaignStyles'
import type { NewCampaignInput } from '@/hooks/useCampaigns'
import type { Campaign, CampaignAspect, CampaignLanguage, Project, SocialPlatform } from '@/types'

const ASPECTS: { value: CampaignAspect; label: string; Icon: typeof Square }[] = [
  { value: 'portrait', label: 'Portrait', Icon: RectangleVertical },
  { value: 'square', label: 'Square', Icon: Square },
  { value: 'landscape', label: 'Landscape', Icon: RectangleHorizontal },
]

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'fb', label: 'Facebook' },
  { value: 'ig', label: 'Instagram' },
]

export function CampaignCreateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreate: (projectId: string, input: NewCampaignInput) => Promise<Campaign | null>
}) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  useEffect(() => {
    if (open) projectsApi.getAll(user?.uid).then(setProjects).catch(() => {})
  }, [open, user?.uid])
  const sortedProjects = [...projects].sort((a, b) => {
    const ap = a.parentProjectId ? 1 : 0
    const bp = b.parentProjectId ? 1 : 0
    if (ap !== bp) return ap - bp
    return a.name.localeCompare(b.name)
  })

  const [projectId, setProjectId] = useState<string | null>(null)
  const project = projects.find((p) => p.id === projectId) || null
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || 'Project'

  const [suggesting, setSuggesting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: '',
    goal: '',
    audience: '',
    tone: 'confident, friendly, concrete',
    count: 6,
    language: 'en' as CampaignLanguage,
    platforms: ['fb', 'ig'] as SocialPlatform[],
    style: DEFAULT_CAMPAIGN_STYLE,
    aspect: 'portrait' as CampaignAspect,
    consistentIdentity: true,
    imageInstructions: '',
    colors: [] as string[],
    startDate: todayISO(),
    cadenceDays: 2,
    postTime: '18:00',
  })
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    const proj = projects.find((p) => p.id === projectId)
    setForm((f) => ({ ...f, colors: proj?.color ? [proj.color] : [] }))
  }, [projectId, projects])

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
    setCreating(true)
    const camp = await onCreate(project.id, {
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
        colors: form.colors.length ? form.colors : project.color ? [project.color] : [],
        logoUrl: project.coverImageUrl || null,
      },
      language: form.language,
      platforms: form.platforms.length ? form.platforms : ['fb', 'ig'],
      style: form.style,
      aspect: form.aspect,
      consistentIdentity: form.consistentIdentity,
      imageInstructions: form.imageInstructions,
    })
    setCreating(false)
    if (camp) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project picker grid */}
          <div className="space-y-1.5">
            <Label className="text-xs">Project</Label>
            <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
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

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {project ? `Brand & images from “${project.name}”` : 'Pick a project above to enable creating.'}
            </p>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSuggest} disabled={suggesting || !project}>
              {suggesting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
              Suggest with AI
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Campaign name</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={project ? `${project.name} Campaign` : 'Campaign name'} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Goal</Label>
                  <Textarea value={form.goal} onChange={(e) => set('goal', e.target.value)} rows={2} className="resize-none" placeholder="e.g. drive signups for the new launch" />
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

                {/* Brand colors */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Brand colors (applied to every image)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {form.colors.map((col, i) => (
                      <div key={i} className="group/clr relative">
                        <input
                          type="color"
                          value={col}
                          onChange={(e) => set('colors', form.colors.map((c, j) => (j === i ? e.target.value : c)))}
                          className="h-8 w-10 cursor-pointer rounded border bg-transparent p-0"
                          title={col}
                        />
                        <button
                          type="button"
                          onClick={() => set('colors', form.colors.filter((_, j) => j !== i))}
                          className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-foreground/80 text-[10px] leading-none text-background group-hover/clr:flex"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {form.colors.length < 4 && (
                      <button
                        type="button"
                        onClick={() => set('colors', [...form.colors, project?.color || '#6B8DD6'])}
                        className="flex h-8 items-center gap-1 rounded-lg border border-dashed px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus className="h-3 w-3" /> Color
                      </button>
                    )}
                  </div>
                </div>

                {/* Aspect ratio */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Aspect ratio</Label>
                  <div className="flex gap-1.5">
                    {ASPECTS.map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('aspect', value)}
                        className={cn(
                          'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                          form.aspect === value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image style */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Image style</Label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {CAMPAIGN_STYLES.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => set('style', s.key)}
                        title={s.prompt}
                        className={cn(
                          'overflow-hidden rounded-lg border text-left transition-all',
                          form.style === s.key ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/40'
                        )}
                      >
                        {s.example ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.example} alt={s.label} className="aspect-square w-full object-contain" loading="lazy" />
                        ) : (
                          <div className="aspect-square w-full" style={{ background: s.swatch }} />
                        )}
                        <p className={cn('truncate px-1.5 py-1 text-[11px] font-medium', form.style === s.key ? 'text-primary' : 'text-muted-foreground')}>
                          {s.label}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Consistent visual identity */}
                <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5 sm:col-span-2">
                  <div className="min-w-0">
                    <Label className="text-xs font-medium">Consistent visual identity</Label>
                    <p className="text-[11px] text-muted-foreground">Generate one shared art direction so all posts look like the same set.</p>
                  </div>
                  <Switch checked={form.consistentIdentity} onCheckedChange={(v) => set('consistentIdentity', v)} />
                </div>

                {/* Custom image instructions */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Custom image instructions (applied to every image)</Label>
                  <Textarea
                    value={form.imageInstructions}
                    onChange={(e) => set('imageInstructions', e.target.value)}
                    rows={2}
                    className="resize-none"
                    placeholder="e.g. always show our coffee cup; no people; clean minimal background; leave space for a headline"
                  />
                </div>
              </div>

              <Button onClick={handleCreate} disabled={creating || !project} className="w-full">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
                {project ? 'Create campaign' : 'Select a project to create'}
              </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
