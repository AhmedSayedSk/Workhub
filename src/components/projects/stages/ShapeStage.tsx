'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Plus, Trash2, Check, Loader2, Sparkles, ChevronDown, Compass, ListChecks,
  ListX, Gauge, Scale, type LucideIcon,
} from 'lucide-react'
import type { Project, Decision, DecisionStatus } from '@/types'
import { projectShape, decisions as decisionsApi, repoSummaries, projectDeploy } from '@/lib/firestore'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface Props { project: Project; canEdit: boolean }

const AUTOSAVE_MS = 900

const ACCENT = {
  vision: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400',
  inScope: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  outScope: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  constraints: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  decisions: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
} as const

const DECISION_DOT: Record<DecisionStatus, string> = {
  open: 'bg-slate-400',
  decided: 'bg-emerald-500',
  reversed: 'bg-amber-500',
}

function TitleChip({ label, icon: Icon, accent }: { label: string; icon?: LucideIcon; accent: string }) {
  return (
    <h3 className={cn(
      'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
      accent,
    )}>
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </h3>
  )
}

/** Click-to-edit list field: edited as one-per-line text, displayed as bullets. */
function ListField({ label, icon, accent, lines, canEdit, onChange }: {
  label: string
  icon?: LucideIcon
  accent: string
  lines: string[]
  canEdit: boolean
  onChange: (lines: string[]) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing && canEdit) {
    return (
      <div>
        <TitleChip label={label} icon={icon} accent={accent} />
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onChange(draft.split('\n').map((l) => l.trim()).filter(Boolean))
            setEditing(false)
          }}
          autoFocus
          placeholder="One item per line"
          className="mt-2 min-h-[110px] resize-y text-sm"
        />
      </div>
    )
  }
  return (
    <div>
      <TitleChip label={label} icon={icon} accent={accent} />
      {lines.length > 0 ? (
        <ul
          onClick={canEdit ? () => { setDraft(lines.join('\n')); setEditing(true) } : undefined}
          className={cn(
            'mt-2 space-y-1 text-sm leading-relaxed text-muted-foreground',
            canEdit && 'cursor-text rounded-md -mx-1.5 px-1.5 py-1 transition hover:bg-muted/50',
          )}
          title={canEdit ? 'Click to edit' : undefined}
        >
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      ) : canEdit ? (
        <button
          type="button"
          onClick={() => { setDraft(''); setEditing(true) }}
          className="mt-2 text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
        >
          Click to add — or use ✨ to generate…
        </button>
      ) : null}
    </div>
  )
}

export function ShapeStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [vision, setVision] = useState('')
  const [inScope, setInScope] = useState<string[]>([])
  const [outScope, setOutScope] = useState<string[]>([])
  const [constraints, setConstraints] = useState<string[]>([])
  const [decs, setDecs] = useState<Decision[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [editingVision, setEditingVision] = useState(false)
  const [generatingShape, setGeneratingShape] = useState(false)
  const [generatingDecs, setGeneratingDecs] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [decOpen, setDecOpen] = useState(false)
  const [newDec, setNewDec] = useState({ title: '', rationale: '' })

  const hydratedRef = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [s, d] = await Promise.all([
        projectShape.get(project.id),
        decisionsApi.listByProject(project.id),
      ])
      if (cancelled) return
      setVision(s?.visionStatement ?? '')
      setInScope(s?.inScope ?? [])
      setOutScope(s?.outOfScope ?? [])
      setConstraints(s?.constraints ?? [])
      setDecs(d)
      requestAnimationFrame(() => { hydratedRef.current = true })
    })()
    return () => { cancelled = true }
  }, [project.id])

  // Debounced autosave for the shape doc.
  useEffect(() => {
    if (!hydratedRef.current || !canEdit || !user) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    setSaveState('saving')
    autosaveTimer.current = setTimeout(async () => {
      try {
        await projectShape.save(project.id, {
          visionStatement: vision,
          inScope,
          outOfScope: outScope,
          constraints,
        }, user.uid)
        setSaveState('saved')
        if (savedFadeTimer.current) clearTimeout(savedFadeTimer.current)
        savedFadeTimer.current = setTimeout(() => setSaveState('idle'), 2000)
      } catch {
        setSaveState('idle')
      }
    }, AUTOSAVE_MS)
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vision, inScope, outScope, constraints])

  /** Shared project context for AI. */
  const buildContext = async (extra: string[] = []) => {
    const [summaries, deploy] = await Promise.all([
      repoSummaries.listByProject(project.id).catch(() => []),
      projectDeploy.get(project.id).catch(() => null),
    ])
    return [
      `Product: ${project.name}`,
      project.description?.trim() && `Description: ${project.description}`,
      summaries.length > 0 && `What the codebase does (repo summaries):\n${summaries.map((s) => `- ${s.summary}`).join('\n')}`,
      (deploy?.technologies?.length ?? 0) > 0 && `Tech stack: ${deploy!.technologies.join(', ')}`,
      ...extra,
    ].filter(Boolean).join('\n\n')
  }

  /** ✨ Draft vision + scope + constraints. */
  const handleGenerateShape = async () => {
    if (!user || generatingShape) return
    setGeneratingShape(true)
    try {
      const context = await buildContext([
        vision.trim() && `Current vision draft:\n${vision}`,
        inScope.length > 0 && `Current in-scope:\n${inScope.join('\n')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_shape', data: { context } }),
      })
      const result = await response.json()
      const shape = result?.data?.shape
      if (shape) {
        if (shape.visionStatement) setVision(shape.visionStatement)
        if (shape.inScope?.length) setInScope(shape.inScope)
        if (shape.outOfScope?.length) setOutScope(shape.outOfScope)
        if (shape.constraints?.length) setConstraints(shape.constraints)
      }
    } catch (err) {
      console.error('Failed to generate shape', err)
    } finally {
      setGeneratingShape(false)
    }
  }

  /** ✨ Suggest critical open decisions. */
  const handleGenerateDecisions = async () => {
    if (!user || generatingDecs) return
    setGeneratingDecs(true)
    try {
      const context = await buildContext([
        vision.trim() && `Vision:\n${vision}`,
        inScope.length > 0 && `In scope:\n${inScope.join('\n')}`,
        outScope.length > 0 && `Out of scope:\n${outScope.join('\n')}`,
        constraints.length > 0 && `Constraints:\n${constraints.join('\n')}`,
        decs.length > 0 && `ALREADY-TRACKED decisions (do not repeat):\n${decs.map((d) => `- [${d.status}] ${d.title}`).join('\n')}`,
      ].filter(Boolean) as string[])
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_shape_decisions', data: { context } }),
      })
      const result = await response.json()
      const generated: { title: string; rationale: string }[] = result?.data?.decisions ?? []
      for (const g of generated) {
        await decisionsApi.add({ projectId: project.id, title: g.title, rationale: g.rationale, status: 'open', authorId: user.uid })
      }
      if (generated.length > 0) setDecs(await decisionsApi.listByProject(project.id))
    } catch (err) {
      console.error('Failed to generate decisions', err)
    } finally {
      setGeneratingDecs(false)
    }
  }

  const openCount = decs.filter((d) => d.status === 'open').length

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[60fr_40fr] lg:items-start">
    <Card className="divide-y">
      {/* Vision */}
      <section className="px-5 py-4">
        <div className="flex items-center justify-between">
          <TitleChip label="Vision" icon={Compass} accent={ACCENT.vision} />
          <span className="flex items-center gap-2">
            {canEdit && saveState !== 'idle' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                {saveState === 'saving'
                  ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
                  : <><Check className="h-3 w-3 text-green-600" /> Saved</>}
              </span>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={handleGenerateShape}
                disabled={generatingShape}
                title="AI: draft vision, scope & constraints from what WorkHub knows about this project"
                aria-label="Generate shape with AI"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
              >
                {generatingShape
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
              </button>
            )}
          </span>
        </div>
        {editingVision && canEdit ? (
          <Textarea
            value={vision}
            onChange={(e) => setVision(e.target.value)}
            onBlur={() => setEditingVision(false)}
            autoFocus
            placeholder="One paragraph describing what this project is and why."
            className="mt-2 min-h-[110px] resize-y text-sm"
          />
        ) : vision.trim() ? (
          <p
            onClick={canEdit ? () => setEditingVision(true) : undefined}
            className={cn(
              'mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground',
              canEdit && 'cursor-text rounded-md -mx-1.5 px-1.5 py-1 transition hover:bg-muted/50',
            )}
            title={canEdit ? 'Click to edit' : undefined}
          >
            {vision}
          </p>
        ) : canEdit ? (
          <button
            type="button"
            onClick={() => setEditingVision(true)}
            className="mt-2 text-sm italic text-muted-foreground/60 hover:text-muted-foreground"
          >
            Click to write — or use ✨ to generate…
          </button>
        ) : null}
      </section>

      {/* Scope */}
      <section className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 md:grid-cols-2">
        <ListField label="In Scope" icon={ListChecks} accent={ACCENT.inScope} lines={inScope} canEdit={canEdit} onChange={setInScope} />
        <ListField label="Out of Scope" icon={ListX} accent={ACCENT.outScope} lines={outScope} canEdit={canEdit} onChange={setOutScope} />
      </section>

      {/* Constraints */}
      <section className="px-5 py-4">
        <ListField label="Constraints" icon={Gauge} accent={ACCENT.constraints} lines={constraints} canEdit={canEdit} onChange={setConstraints} />
      </section>
    </Card>

    {/* Right rail — Decisions */}
    <Card className="px-4 py-3 lg:sticky lg:top-0">
      <div className="flex items-center justify-between">
        <TitleChip label="Decisions" icon={Scale} accent={ACCENT.decisions} />
        <span className="flex items-center gap-2">
          {openCount > 0 && (
            <span className="text-[11px] text-muted-foreground">{openCount} open</span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={handleGenerateDecisions}
              disabled={generatingDecs}
              title="AI: surface the critical decisions this project must lock"
              aria-label="Generate decisions with AI"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              {generatingDecs
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
            </button>
          )}
          {canEdit && (
            <Popover open={decOpen} onOpenChange={setDecOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Add decision"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">New decision</p>
                  <Input placeholder="Decision (as a question)" value={newDec.title} onChange={(e) => setNewDec({ ...newDec, title: e.target.value })} autoFocus />
                  <Textarea placeholder="Rationale / trade-off (optional)" value={newDec.rationale} onChange={(e) => setNewDec({ ...newDec, rationale: e.target.value })} className="min-h-[60px] text-xs" />
                  <Button className="w-full" disabled={!newDec.title.trim()} onClick={async () => {
                    if (!user) return
                    setDecOpen(false)
                    await decisionsApi.add({ projectId: project.id, title: newDec.title.trim(), rationale: newDec.rationale.trim(), status: 'open', authorId: user.uid })
                    setNewDec({ title: '', rationale: '' })
                    setDecs(await decisionsApi.listByProject(project.id))
                  }}>
                    <Plus className="mr-1 h-4 w-4" /> Add decision
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </span>
      </div>

      <div className="mt-2.5 space-y-0.5">
        {decs.length === 0 && (
          <p className="text-sm italic text-muted-foreground/60">
            No decisions yet — hit ✨ to surface the critical ones to lock.
          </p>
        )}
        {decs.map((d) => {
          const expanded = expandedId === d.id
          return (
            <div key={d.id}>
              <div className="group/row flex items-center gap-2">
                {canEdit ? (
                  <Select value={d.status} onValueChange={async (v) => {
                    if (!user) return
                    await decisionsApi.setStatus(d.id, project.id, v as DecisionStatus, user.uid)
                    setDecs(await decisionsApi.listByProject(project.id))
                  }}>
                    <SelectTrigger aria-label={`Status: ${d.status}`} title={d.status} className="h-auto w-auto border-0 bg-transparent p-1 shadow-none [&>svg]:hidden">
                      <span className={cn('block h-2 w-2 rounded-full', DECISION_DOT[d.status])} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">open</SelectItem>
                      <SelectItem value="decided">decided</SelectItem>
                      <SelectItem value="reversed">reversed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span title={d.status} className={cn('h-2 w-2 shrink-0 rounded-full', DECISION_DOT[d.status])} />
                )}
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : d.id)}
                  className="flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left transition hover:bg-muted/50"
                >
                  <span className={cn('min-w-0 flex-1 truncate text-sm', d.status === 'decided' && 'text-muted-foreground')}>
                    {d.title}
                  </span>
                  <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground/50 transition-transform', expanded && 'rotate-180')} />
                </button>
                {canEdit && (
                  <button
                    onClick={async () => {
                      if (!user) return
                      await decisionsApi.remove(d.id, project.id, user.uid)
                      setDecs(await decisionsApi.listByProject(project.id))
                    }}
                    className="text-muted-foreground/0 transition group-hover/row:text-muted-foreground hover:!text-destructive"
                    aria-label="Delete decision"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
              {expanded && d.rationale && (
                <p className="ml-6 mt-0.5 mb-1.5 rounded-md bg-muted/40 p-2.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {d.rationale}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
    </div>
  )
}
