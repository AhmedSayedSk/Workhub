'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { authFetch } from '@/lib/api-client'
import { useFeatures, useTasks } from '@/hooks/useTasks'
import { useMembers } from '@/hooks/useMembers'
import { useClaudeSessions } from '@/hooks/useClaudeSessions'
import { Task, TaskInput, FeatureInput, TaskStatus, TaskType, ClaudeSessionTaskResult, ClaudeSessionFileChange, ClaudeSessionFileEdit } from '@/types'
import { FeatureList } from '@/components/features/FeatureList'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { TaskArchive } from '@/components/tasks/TaskArchive'
import { Confetti } from '@/components/ui/confetti'
import { Loader2, Archive, Bot, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { claudeSessions } from '@/lib/firestore'
import { useAI } from '@/hooks/useAI'
import { useSettings } from '@/hooks/useSettings'

interface ProcessingPanelProps {
  projectId: string
  projectName: string
  repoPath: string | null
  submittedTaskIds: string[]
  tasks: Task[]
  onSessionCreated?: (id: string) => void
}

type ToolCategory = 'read' | 'write' | 'edit' | 'bash' | 'search' | 'agent' | 'timer' | 'task-mgmt' | 'mcp' | 'todo' | 'other'

interface OutputLine {
  text: string
  type: 'system' | 'assistant' | 'tool-call' | 'tool-result' | 'code-add' | 'code-remove' | 'error' | 'info'
  toolCategory?: ToolCategory
}

/** Map raw tool name to a category */
function getToolCategory(name: string): ToolCategory {
  const lower = name.toLowerCase()
  if (lower === 'read') return 'read'
  if (lower === 'write') return 'write'
  if (lower === 'edit' || lower === 'notebookedit') return 'edit'
  if (lower === 'bash') return 'bash'
  if (lower === 'glob' || lower === 'grep') return 'search'
  if (lower === 'task' || lower === 'agent') return 'agent'
  if (lower === 'todowrite') return 'todo'
  if (lower.startsWith('mcp__')) {
    if (lower.includes('start_timer') || lower.includes('stop_timer') || lower.includes('log_time') || lower.includes('get_timer_status') || lower.includes('get_time_summary')) return 'timer'
    if (lower.includes('update_task_status') || lower.includes('add_task_comment') || lower.includes('get_task_details')) return 'task-mgmt'
    return 'mcp'
  }
  return 'other'
}

function formatToolName(name: string): string {
  let clean = name.replace(/^mcp__workhub__/, '').replace(/^mcp__firebase__/, 'fb:')
  clean = clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return clean
}

function shortPath(p: string): string {
  let s = p.replace(/^\/home\/ahmedsk\b/, '~')
  const parts = s.split('/')
  return parts.length > 4 ? '~/' + parts.slice(-3).join('/') : s
}

function collapseHome(s: string): string {
  return s.replace(/\/home\/ahmedsk\b/g, '~')
}

function truncate(s: string, max: number): string {
  const flat = s.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  return flat.length <= max ? flat : flat.slice(0, max) + '...'
}

function truncateCode(s: string, maxLines: number): string {
  const lines = s.split('\n')
  if (lines.length <= maxLines) return s
  return lines.slice(0, maxLines).join('\n') + `\n... (+${lines.length - maxLines} more lines)`
}

function formatToolInput(input: unknown, excludeKeys: string[] = []): string {
  if (!input) return ''
  if (typeof input === 'string') return collapseHome(truncate(input, 120))
  const obj = input as Record<string, unknown>
  const keys = Object.keys(obj).filter((k) => !excludeKeys.includes(k))
  if (keys.length === 0) return ''
  const parts = keys.map((k) => {
    const val = obj[k]
    if (typeof val === 'string') return `${k}: "${collapseHome(truncate(val, 60))}"`
    return `${k}: ${collapseHome(truncate(JSON.stringify(val), 60))}`
  })
  const oneLiner = parts.join(', ')
  return oneLiner.length <= 200 ? oneLiner : parts.slice(0, 3).join(', ') + (keys.length > 3 ? ', ...' : '')
}

/** Headless background processor — no UI, just runs the stream and flushes to Firestore */
function BackgroundProcessor({ projectId, projectName, repoPath, submittedTaskIds, tasks, onSessionCreated }: ProcessingPanelProps) {
  const isStartedRef = useRef(false)
  const bufferRef = useRef('')
  const linesRef = useRef<OutputLine[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const modelRef = useRef<string>('unknown')
  const processIdRef = useRef<string | null>(null)
  const flushedCountRef = useRef(0)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamTaskStatusRef = useRef<Record<string, string>>({})
  const fileChangesRef = useRef<ClaudeSessionFileChange[]>([])
  const worktreeBranchRef = useRef<string | null>(null)

  const addLine = useCallback((text: string, type: OutputLine['type'] = 'info', toolCategory?: ToolCategory) => {
    linesRef.current = [...linesRef.current, { text, type, toolCategory }]
  }, [])

  const trackFileChange = useCallback((filePath: string, edit: ClaudeSessionFileEdit) => {
    const prev = fileChangesRef.current
    const idx = prev.findIndex(f => f.filePath === filePath)
    if (idx >= 0) {
      prev[idx] = {
        ...prev[idx],
        changeType: prev[idx].changeType === 'created' ? 'created' : (edit.type === 'create' ? 'created' : 'modified'),
        edits: [...prev[idx].edits, edit],
      }
    } else {
      prev.push({
        filePath,
        shortPath: shortPath(filePath),
        changeType: edit.type === 'create' ? 'created' : 'modified',
        edits: [edit],
      })
    }
    fileChangesRef.current = [...prev]
  }, [])

  const flushTranscript = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid) return
    const allLines = linesRef.current
    const flushed = flushedCountRef.current
    if (allLines.length <= flushed) return
    const newLines = allLines.slice(flushed).map((l) => JSON.stringify(l))
    try {
      await claudeSessions.appendTranscript(sid, newLines, allLines.length)
      flushedCountRef.current = allLines.length
      const updates: Partial<import('@/types').ClaudeSessionInput> = {}
      if (fileChangesRef.current.length > 0) updates.fileChanges = fileChangesRef.current
      if (worktreeBranchRef.current) updates.worktreeBranch = worktreeBranchRef.current
      if (Object.keys(updates).length > 0) {
        await claudeSessions.update(sid, updates).catch(() => {})
      }
    } catch {
      // Next flush will retry
    }
  }, [])

  const processStreamLine = useCallback((raw: string) => {
    if (!raw.trim()) return
    try {
      const event = JSON.parse(raw)
      const eventType = event.type as string

      // Process ID from our API wrapper
      if (eventType === 'process_id' && event.processId) {
        processIdRef.current = event.processId
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { processId: event.processId }).catch(() => {})
        }
        return
      }

      if (eventType === 'system' && event.subtype === 'init') {
        addLine(`Session started (model: ${event.model})`, 'system')
        if (event.model) {
          modelRef.current = event.model
          if (sessionIdRef.current) {
            claudeSessions.update(sessionIdRef.current, { model: event.model }).catch(() => {})
          }
        }
        return
      }

      if (eventType === 'assistant' && event.message?.content) {
        // Clear waiting state — Claude resumed
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current)
          waitingTimerRef.current = null
        }
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { waitingForInput: false }).catch(() => {})
        }
        const content = event.message.content as Array<{ type: string; text?: string; name?: string; input?: unknown }>
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            addLine(block.text, 'assistant')
            // Detect file changes from sub-agent text output
            for (const tl of block.text.split('\n')) {
              const wm = tl.match(/📝\s*Write\s+(.+)/)
              if (wm) trackFileChange(wm[1].trim(), { type: 'create' })
              const em = tl.match(/✏️\s*Edit\s+(.+)/)
              if (em) trackFileChange(em[1].trim(), { type: 'edit' })
              // Detect worktree/branch name from text
              if (!worktreeBranchRef.current) {
                const branchTextMatch = tl.match(/[Bb]ranch[:\s]+[`"']?(task\/[\w-]+)[`"']?/)
                if (branchTextMatch) worktreeBranchRef.current = branchTextMatch[1]
              }
            }
          }
          if (block.type === 'tool_use' && block.name) {
            const category = getToolCategory(block.name)
            const name = formatToolName(block.name)
            const inp = block.input as Record<string, unknown> | undefined
            if (category === 'read' && inp?.file_path) {
              const extra = formatToolInput(inp, ['file_path'])
              addLine(`📖 Read ${shortPath(String(inp.file_path))}${extra ? ` (${extra})` : ''}`, 'tool-call', category)
            } else if (category === 'bash' && inp?.command) {
              addLine(`$ ${truncate(String(inp.command), 120)}`, 'tool-call', category)
            } else if (category === 'write' && inp?.file_path) {
              addLine(`📝 Write ${shortPath(String(inp.file_path))}`, 'tool-call', category)
              trackFileChange(String(inp.file_path), { type: 'create', content: typeof inp.content === 'string' ? inp.content : undefined })
            } else if (category === 'edit' && inp?.file_path) {
              addLine(`✏️ Edit ${shortPath(String(inp.file_path))}`, 'tool-call', category)
              trackFileChange(String(inp.file_path), { type: 'edit', oldString: typeof inp.old_string === 'string' ? inp.old_string : undefined, newString: typeof inp.new_string === 'string' ? inp.new_string : undefined })
            } else if (category === 'search') {
              const target = inp?.pattern || inp?.path || ''
              const extra = formatToolInput(inp, ['pattern', 'path', 'output_mode'])
              addLine(`🔍 ${name} "${truncate(String(target), 60)}"${extra ? ` (${extra})` : ''}`, 'tool-call', category)
            } else if (category === 'agent') {
              addLine(`🤖 Agent: ${inp?.description || ''}`, 'tool-call', category)
              if (inp?.isolation === 'worktree') {
                const promptText = typeof inp.prompt === 'string' ? inp.prompt : ''
                const branchMatch = promptText.match(/branch\s+(?:named?\s+)?[`"']?(task\/[\w-]+)[`"']?/i)
                if (branchMatch) worktreeBranchRef.current = branchMatch[1]
              }
            } else if (category === 'timer') {
              const lower = block.name?.toLowerCase() || ''
              const notes = inp?.notes ? ` — ${truncate(String(inp.notes), 80)}` : ''
              const duration = inp?.duration ? ` (${inp.duration})` : ''
              if (lower.includes('start_timer')) addLine(`⏱️ Timer started${duration}${notes}`, 'tool-call', category)
              else if (lower.includes('stop_timer')) addLine(`⏱️ Timer stopped${notes}`, 'tool-call', category)
              else if (lower.includes('log_time')) addLine(`⏱️ Logged ${inp?.duration || '?'}${notes}`, 'tool-call', category)
              else addLine(`⏱️ ${name}`, 'tool-call', category)
            } else if (category === 'task-mgmt') {
              const lower = block.name?.toLowerCase() || ''
              if (lower.includes('update_task_status')) {
                addLine(`📋 Task → ${inp?.status || '?'}${inp?.comment ? ` — ${truncate(String(inp.comment), 80)}` : ''}`, 'tool-call', category)
                if (inp?.taskId && inp?.status) {
                  streamTaskStatusRef.current = { ...streamTaskStatusRef.current, [String(inp.taskId)]: String(inp.status) }
                }
              }
              else if (lower.includes('add_task_comment')) addLine(`📋 Comment added${inp?.text ? `: ${truncate(String(inp.text), 100)}` : ''}`, 'tool-call', category)
              else if (lower.includes('get_task_details')) addLine(`📋 Fetching task details`, 'tool-call', category)
              else addLine(`📋 ${name}`, 'tool-call', category)
            } else if (category === 'todo') {
              addLine(`☑️ Internal checklist updated`, 'tool-call', category)
            } else {
              const args = formatToolInput(inp)
              addLine(`→ ${name}${args ? `(${args})` : '()'}`, 'tool-call', category)
            }
          }
          if (block.type === 'tool_result') {
            const text = block.text || (typeof block.input === 'string' ? block.input : '')
            if (text) {
              addLine(truncate(text, 300), 'tool-result')
              for (const rl of String(text).split('\n')) {
                const wm = rl.match(/📝\s*Write\s+(.+)/)
                if (wm) trackFileChange(wm[1].trim(), { type: 'create' })
                const em = rl.match(/✏️\s*Edit\s+(.+)/)
                if (em) trackFileChange(em[1].trim(), { type: 'edit' })
              }
            }
          }
        }
        return
      }

      if (eventType === 'result') {
        if (event.result) addLine(event.result, 'assistant')
        // Start 2s timer: if no process_exit follows, Claude is waiting for input
        if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current)
        waitingTimerRef.current = setTimeout(() => {
          if (sessionIdRef.current) {
            claudeSessions.update(sessionIdRef.current, { waitingForInput: true }).catch(() => {})
          }
        }, 2000)
        return
      }
      if (eventType === 'stderr') { addLine(event.text, 'error'); return }
      if (eventType === 'process_exit') {
        if (waitingTimerRef.current) { clearTimeout(waitingTimerRef.current); waitingTimerRef.current = null }
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { waitingForInput: false, processId: null }).catch(() => {})
        }
        addLine(`Process exited (code ${event.code})`, 'system')
        return
      }
      if (eventType === 'process_error') { addLine(`Process error: ${event.message}`, 'error'); return }
    } catch {
      if (raw.trim()) addLine(raw, 'info')
    }
  }, [addLine, trackFileChange])

  useEffect(() => {
    if (isStartedRef.current) return
    isStartedRef.current = true

    addLine('Launching Claude Code...', 'system')

    ;(async () => {
      try {
        const taskResults: ClaudeSessionTaskResult[] = submittedTaskIds.map((tid) => {
          const task = tasks.find((t) => t.id === tid)
          return { taskId: tid, taskName: task?.name || tid, status: 'pending' as const, branchName: null }
        })
        const sessionId = await claudeSessions.create({
          projectId,
          taskIds: submittedTaskIds,
          status: 'running',
          model: 'unknown',
          processId: null,
          waitingForInput: false,
          startedAt: new Date(),
          completedAt: null,
          taskResults,
          summary: '',
          transcript: [],
          fileChanges: [],
          worktreeBranch: null,
          lineCount: 0,
          lastFlushAt: null,
        })
        sessionIdRef.current = sessionId
        onSessionCreated?.(sessionId)
        flushTimerRef.current = setInterval(flushTranscript, 5000)
      } catch {
        // Non-critical
      }

      try {
        const res = await authFetch('/api/process-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, projectName, repoPath, taskIds: submittedTaskIds }),
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          addLine(`API Error: ${errText}`, 'error')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          bufferRef.current += chunk
          const parts = bufferRef.current.split('\n')
          bufferRef.current = parts.pop() || ''
          for (const part of parts) processStreamLine(part)
          if (linesRef.current.length - flushedCountRef.current >= 30) flushTranscript()
        }

        if (bufferRef.current.trim()) {
          processStreamLine(bufferRef.current)
          bufferRef.current = ''
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          addLine(`Connection error: ${err.message}`, 'error')
        }
      } finally {
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current)
          flushTimerRef.current = null
        }
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current)
          waitingTimerRef.current = null
        }

        if (sessionIdRef.current) {
          try {
            await flushTranscript()
            const allLines = linesRef.current
            const hasError = allLines.some((l) => l.type === 'error')
            const lastAssistant = [...allLines].reverse().find((l) => l.type === 'assistant')
            const summary = lastAssistant?.text?.slice(0, 500) || ''
            const taskResults: ClaudeSessionTaskResult[] = submittedTaskIds.map((tid) => {
              const task = tasks.find((t) => t.id === tid)
              const effectiveStatus = streamTaskStatusRef.current[tid] || task?.status
              let status: ClaudeSessionTaskResult['status'] = 'pending'
              if (effectiveStatus === 'in_progress') status = 'processing'
              else if (effectiveStatus === 'review' || effectiveStatus === 'done') status = 'completed'
              return { taskId: tid, taskName: task?.name || tid, status, branchName: null }
            })
            await claudeSessions.update(sessionIdRef.current, {
              status: hasError ? 'failed' : 'completed',
              completedAt: new Date(),
              model: modelRef.current,
              processId: null,
              waitingForInput: false,
              taskResults,
              summary,
              fileChanges: fileChangesRef.current,
              worktreeBranch: worktreeBranchRef.current,
              lineCount: allLines.length,
              lastFlushAt: new Date(),
            })
          } catch {
            // Non-critical
          }
        }
      }
    })()

    return () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current)
        flushTimerRef.current = null
      }
      if (waitingTimerRef.current) {
        clearTimeout(waitingTimerRef.current)
        waitingTimerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null // No UI
}

interface ProjectTasksTabProps {
  projectId: string
  projectName: string
  repoPath: string | null
  onSwitchToAiTab?: () => void
  canArchive?: boolean
  canRunAi?: boolean
}

export function ProjectTasksTab({ projectId, projectName, repoPath, onSwitchToAiTab, canArchive = true, canRunAi = true }: ProjectTasksTabProps) {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<{ active: boolean; x?: number; y?: number }>({ active: false })
  const [boardRefreshKey, setBoardRefreshKey] = useState(0)
  const [showArchive, setShowArchive] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [processingTaskIds, setProcessingTaskIds] = useState<string[] | null>(null)
  const { suggestTaskIcon } = useAI()
  const { settings } = useSettings()

  const handleBoardDataChanged = useCallback(() => {
    setBoardRefreshKey((k) => k + 1)
  }, [])

  const {
    features,
    loading: featuresLoading,
    createFeature,
    updateFeature,
    deleteFeature,
  } = useFeatures(projectId)

  const { members: allMembers } = useMembers()
  const { sessions } = useClaudeSessions(projectId)

  // Derive set of task IDs currently being processed by AI
  const aiProcessingTaskIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of sessions) {
      if (s.status === 'running') {
        for (const tid of s.taskIds) ids.add(tid)
      }
    }
    return ids
  }, [sessions])

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    archiveTask,
    unarchiveTask,
    permanentDeleteTask,
    setTaskWaiting,
    removeTaskWaiting,
    reorderTask,
  } = useTasks(projectId, undefined, projectName)

  // Separate active and archived tasks
  const { activeTasks, archivedTasks } = useMemo(() => {
    const active: Task[] = []
    const archived: Task[] = []
    tasks.forEach((t) => {
      if (t.archived) {
        archived.push(t)
      } else {
        active.push(t)
      }
    })
    return { activeTasks: active, archivedTasks: archived }
  }, [tasks])

  // Filter active tasks by selected feature
  const filteredTasks = useMemo(() => {
    if (selectedFeatureId === null) {
      return activeTasks
    }
    return activeTasks.filter((t) => t.featureId === selectedFeatureId)
  }, [activeTasks, selectedFeatureId])

  // Derive selectedTask from tasks list - this ensures it stays in sync
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null
    return tasks.find((t) => t.id === selectedTaskId) || null
  }, [tasks, selectedTaskId])

  const handleCreateFeature = async (data: FeatureInput) => {
    await createFeature(data)
  }

  const handleUpdateFeature = async (id: string, data: Partial<FeatureInput>) => {
    await updateFeature(id, data)
  }

  const handleDeleteFeature = async (id: string) => {
    await deleteFeature(id)
  }

  const handleCreateTask = async (data: TaskInput) => {
    const taskId = await createTask({
      ...data,
      // If a feature is selected, use it. Otherwise use whatever was provided
      featureId: selectedFeatureId || data.featureId,
    })

    // Non-blocking: suggest an icon via AI if enabled
    if (taskId && settings?.aiEnabled) {
      suggestTaskIcon(data.name, data.description, data.taskType).then((iconName) => {
        if (iconName) {
          updateTask(taskId, { icon: iconName } as Partial<TaskInput>)
        }
      })
    }
  }

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    if (updates.status === 'done') {
      const task = tasks.find((t) => t.id === id)
      if (task && task.status !== 'done') {
        setConfetti({ active: true })
      }
    }
    await updateTask(id, updates as Partial<TaskInput>)

    // If task has no icon and AI is enabled, suggest one after edit
    if (settings?.aiEnabled) {
      const task = tasks.find((t) => t.id === id)
      if (task && !task.icon) {
        const name = (updates.name as string) || task.name
        const description = (updates.description as string) || task.description
        const taskType = (updates.taskType as string) || task.taskType
        suggestTaskIcon(name, description, taskType).then((iconName) => {
          if (iconName) {
            updateTask(id, { icon: iconName } as Partial<TaskInput>)
          }
        })
      }
    }
  }

  const handleArchiveTask = async (id: string) => {
    await archiveTask(id)
    if (selectedTaskId === id) {
      setSelectedTaskId(null)
    }
  }

  const handleSetTaskWaiting = async (id: string) => {
    await setTaskWaiting(id)
  }

  const handleRemoveTaskWaiting = async (id: string) => {
    await removeTaskWaiting(id)
  }

  const handleUnarchiveTask = async (id: string) => {
    await unarchiveTask(id)
  }

  const handlePermanentDeleteTask = async (id: string) => {
    await permanentDeleteTask(id)
  }

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id)
  }

  const handleReorderTask = async (taskId: string, newStatus: TaskStatus, newSortOrder: number) => {
    await reorderTask(taskId, newStatus, newSortOrder)
  }

  const handleTaskMovedToDone = (x: number, y: number) => {
    setConfetti({ active: true, x, y })
  }

  const handleProcessingStarted = (taskIds: string[]) => {
    setProcessingTaskIds(taskIds)
    setSelectionMode(false)
    // Switch to AI Sessions tab
    onSwitchToAiTab?.()
  }

  const handleCloseTaskDetail = (open: boolean) => {
    if (!open) {
      setSelectedTaskId(null)
    }
  }

  const loading = featuresLoading || tasksLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <Confetti active={confetti.active} originX={confetti.x} originY={confetti.y} onComplete={() => setConfetti({ active: false })} />
      {/* Features Sidebar */}
      <aside className="w-full lg:w-80 lg:min-w-80 lg:max-w-80 flex-shrink-0 border rounded-lg bg-card flex flex-col h-[540px] lg:h-auto">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <FeatureList
            features={features}
            tasks={tasks}
            projectId={projectId}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={setSelectedFeatureId}
            onCreateFeature={handleCreateFeature}
            onUpdateFeature={handleUpdateFeature}
            onDeleteFeature={handleDeleteFeature}
          />
        </div>
        {/* Claude Code Selection Controls */}
        {canRunAi && (
        <div className="shrink-0 border-t p-3">
          {selectionMode ? (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelectionMode(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel Selection
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectionMode(true)}>
              <Bot className="h-4 w-4 mr-2" />
              Process with Claude
            </Button>
          )}
        </div>
        )}
      </aside>

      {/* Task Board */}
      <div className="flex-1 min-w-0 relative">
        {/* Archive Button - floating card style */}
        {canArchive && (
        <button
          onClick={() => setShowArchive(true)}
          className="absolute -top-11 right-0 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all duration-200 text-sm"
        >
          <Archive className="h-4 w-4" />
          <span>Archive</span>
          {archivedTasks.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full min-w-[20px] text-center">
              {archivedTasks.length}
            </span>
          )}
        </button>
        )}
        <TaskBoard
          tasks={filteredTasks}
          features={features}
          projectId={projectId}
          projectName={projectName}
          allMembers={allMembers}
          selectedFeatureId={selectedFeatureId}
          selectionMode={selectionMode}
          aiProcessingTaskIds={aiProcessingTaskIds}
          onProcessingStarted={handleProcessingStarted}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onArchiveTask={canArchive ? handleArchiveTask : undefined}
          onSetTaskWaiting={handleSetTaskWaiting}
          onRemoveTaskWaiting={handleRemoveTaskWaiting}
          onSelectTask={handleSelectTask}
          onReorderTask={handleReorderTask}
          onTaskMovedToDone={handleTaskMovedToDone}
          refreshKey={boardRefreshKey}
        />
      </div>

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        projectName={projectName}
        features={features}
        allMembers={allMembers}
        open={!!selectedTask}
        onOpenChange={handleCloseTaskDetail}
        onUpdateTask={handleUpdateTask}
        onArchiveTask={canArchive ? handleArchiveTask : undefined}
        onSetTaskWaiting={handleSetTaskWaiting}
        onRemoveTaskWaiting={handleRemoveTaskWaiting}
        onDataChanged={handleBoardDataChanged}
      />

      {/* Archive Section */}
      <TaskArchive
        tasks={archivedTasks}
        features={features}
        open={showArchive}
        onOpenChange={setShowArchive}
        onUnarchiveTask={handleUnarchiveTask}
        onPermanentDeleteTask={handlePermanentDeleteTask}
      />

      {/* Headless background processor — no visible UI */}
      {processingTaskIds && (
        <BackgroundProcessor
          projectId={projectId}
          projectName={projectName}
          repoPath={repoPath}
          submittedTaskIds={processingTaskIds}
          tasks={tasks}
        />
      )}
    </div>
  )
}
