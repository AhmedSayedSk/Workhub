'use client'

import { useEffect, useState } from 'react'
import {
  Check, Loader2, Sparkles, ChevronDown, SkipForward, ListPlus, Navigation,
} from 'lucide-react'
import type { Project, NextStep, NextStepEffort } from '@/types'
import { nextSteps as nextStepsApi, tasks as tasksApi } from '@/lib/firestore'
import { buildFullProjectContext } from '@/lib/project-context'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { STAGE_META } from './stageMeta'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface Props { project: Project; canEdit: boolean }

const EFFORT_LABEL: Record<NextStepEffort, string> = {
  minutes: '~minutes',
  hours: '~hours',
  days: '~days',
}

const EFFORT_TASK: Record<NextStepEffort, { priority: 'low' | 'medium' | 'high'; hours: number }> = {
  minutes: { priority: 'low', hours: 0.5 },
  hours: { priority: 'medium', hours: 4 },
  days: { priority: 'high', hours: 16 },
}

export function NextStage({ project, canEdit }: Props) {
  const { user } = useAuth()
  const [steps, setSteps] = useState<NextStep[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [acting, setActing] = useState(false)
  const [taskCreatedFor, setTaskCreatedFor] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    nextStepsApi.listByProject(project.id)
      .then((list) => { if (!cancelled) setSteps(list) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [project.id])

  const pending = steps.filter((s) => s.status === 'pending').sort((a, b) => a.rank - b.rank)
  const current = pending[0] ?? null
  const history = steps.filter((s) => s.status !== 'pending')

  /** ✨ Read everything → generate 3 ranked steps. */
  const handleGenerate = async () => {
    if (!user || generating) return
    setGenerating(true)
    try {
      // Retire any leftover pending steps from a previous batch first.
      for (const s of pending) {
        await nextStepsApi.setStatus(s.id, project.id, 'skipped', user.uid)
      }
      const context = await buildFullProjectContext(project)
      const response = await authFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_next_steps', data: { context } }),
      })
      const result = await response.json()
      const generated: { title: string; why: string; how: string; stage: NextStep['stage']; effort: NextStepEffort }[] =
        result?.data?.steps ?? []
      let rank = 1
      for (const g of generated) {
        await nextStepsApi.add({ projectId: project.id, ...g, rank: rank++ }, user.uid)
      }
      setSteps(await nextStepsApi.listByProject(project.id))
    } catch (err) {
      console.error('Failed to generate next steps', err)
    } finally {
      setGenerating(false)
    }
  }

  const resolve = async (step: NextStep, status: 'done' | 'skipped') => {
    if (!user || acting) return
    setActing(true)
    try {
      await nextStepsApi.setStatus(step.id, project.id, status, user.uid)
      setSteps((curr) => curr.map((s) => (s.id === step.id ? { ...s, status } : s)))
    } finally {
      setActing(false)
    }
  }

  /** Push the step into the Build board as a real task, then mark it done here. */
  const makeTask = async (step: NextStep) => {
    if (!user || acting) return
    setActing(true)
    try {
      const t = EFFORT_TASK[step.effort]
      await tasksApi.create({
        featureId: '',
        projectId: project.id,
        name: step.title,
        description: `${step.why}\n\nHow: ${step.how}\n\n(From the Next compass)`,
        status: 'todo',
        taskType: 'task',
        priority: t.priority,
        estimatedHours: t.hours,
      })
      await nextStepsApi.setStatus(step.id, project.id, 'done', user.uid)
      setSteps((curr) => curr.map((s) => (s.id === step.id ? { ...s, status: 'done' as const } : s)))
      setTaskCreatedFor(step.id)
      setTimeout(() => setTaskCreatedFor(null), 3000)
    } finally {
      setActing(false)
    }
  }

  const stageMeta = current ? STAGE_META[current.stage] : null
  const StageIcon = stageMeta?.icon

  return (
    <div className="flex flex-col items-center pt-6">
      <div className="w-full max-w-xl space-y-4">

        {/* Queue dots */}
        {pending.length > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {pending.map((s, i) => (
              <span key={s.id} className={cn('h-1.5 rounded-full transition-all', i === 0 ? 'w-5 bg-teal-500' : 'w-1.5 bg-muted-foreground/30')} />
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : current ? (
          /* THE step */
          <Card className="p-6">
            <div className="flex items-center gap-2">
              {stageMeta && StageIcon && (
                <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider', stageMeta.pillClass)}>
                  <StageIcon className="h-3.5 w-3.5" />
                  {stageMeta.label}
                </span>
              )}
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                {EFFORT_LABEL[current.effort]}
              </span>
            </div>

            <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight">{current.title}</h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground/70">Why — </span>{current.why}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground/70">How — </span>{current.how}
            </p>

            {canEdit && (
              <div className="mt-5 flex items-center gap-2">
                <Button onClick={() => resolve(current, 'done')} disabled={acting} className="gap-1.5">
                  <Check className="h-4 w-4" /> Done
                </Button>
                <Button variant="outline" onClick={() => makeTask(current)} disabled={acting} className="gap-1.5">
                  <ListPlus className="h-4 w-4" /> Make it a task
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => resolve(current, 'skipped')} disabled={acting} className="gap-1.5 text-muted-foreground">
                  Skip <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            )}
            {taskCreatedFor && (
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">✓ Task created on the Build board</p>
            )}
          </Card>
        ) : (
          /* Empty / exhausted queue */
          <Card className="flex flex-col items-center p-10 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400">
              <Navigation className="h-7 w-7" />
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              The compass reads everything in this project — every stage, decision, finding, task and repo — and tells you the single highest-leverage thing to do next.
            </p>
            {canEdit && (
              <Button onClick={handleGenerate} disabled={generating} size="lg" className="mt-6 gap-2">
                {generating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading the whole project…</>
                  : <><Sparkles className="h-4 w-4" /> What should I do next?</>}
              </Button>
            )}
          </Card>
        )}

        {/* Regenerate while a queue is showing */}
        {current && canEdit && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 transition hover:text-muted-foreground disabled:opacity-60"
            >
              {generating
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Re-reading the whole project…</>
                : <><Sparkles className="h-3 w-3" /> Re-think from scratch</>}
            </button>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="mx-auto flex items-center gap-1 text-xs text-muted-foreground/60 transition hover:text-muted-foreground"
            >
              History ({history.length})
              <ChevronDown className={cn('h-3 w-3 transition-transform', historyOpen && 'rotate-180')} />
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1">
                {history.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground">
                    {s.status === 'done'
                      ? <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                      : <SkipForward className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                    <span className={cn('truncate', s.status === 'skipped' && 'line-through decoration-muted-foreground/40')}>
                      {s.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
