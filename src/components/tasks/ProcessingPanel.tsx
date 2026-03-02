'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Task, ClaudeSessionTaskResult, ClaudeSessionFileChange, ClaudeSessionFileEdit } from '@/types'
import { claudeSessions } from '@/lib/firestore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Bot, X, CheckCircle2, Loader2, Circle, Minimize2, Maximize2, Square, Send, MessageCircleQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileChangesPanel } from '@/components/tasks/TranscriptRenderer'

interface ProcessingPanelProps {
  projectId: string
  projectName: string
  repoPath: string | null
  submittedTaskIds: string[]
  tasks: Task[]
  onClose: () => void
  onSessionCreated?: (id: string) => void
}

type ToolCategory = 'read' | 'write' | 'edit' | 'bash' | 'search' | 'agent' | 'timer' | 'task-mgmt' | 'mcp' | 'todo' | 'other'

interface OutputLine {
  text: string
  type: 'system' | 'assistant' | 'tool-call' | 'tool-result' | 'code-add' | 'code-remove' | 'error' | 'info' | 'user'
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
  // MCP sub-categories
  if (lower.startsWith('mcp__')) {
    if (lower.includes('start_timer') || lower.includes('stop_timer') || lower.includes('log_time') || lower.includes('get_timer_status') || lower.includes('get_time_summary')) return 'timer'
    if (lower.includes('update_task_status') || lower.includes('add_task_comment') || lower.includes('get_task_details')) return 'task-mgmt'
    return 'mcp'
  }
  return 'other'
}

/** Icon prefix per tool category */
const toolIcons: Record<ToolCategory, string> = {
  read: '📖',
  write: '📝',
  edit: '✏️',
  bash: '$',
  search: '🔍',
  agent: '🤖',
  timer: '⏱️',
  'task-mgmt': '📋',
  mcp: '⚡',
  todo: '☑️',
  other: '→',
}

/** Clean up tool names for display */
function formatToolName(name: string): string {
  let clean = name
    .replace(/^mcp__workhub__/, '')
    .replace(/^mcp__firebase__/, 'fb:')
  clean = clean.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return clean
}

/** Shorten a path: replace home dir with ~, show last 3 segments */
function shortPath(p: string): string {
  let s = p.replace(/^\/home\/ahmedsk\b/, '~')
  const parts = s.split('/')
  return parts.length > 4 ? '~/' + parts.slice(-3).join('/') : s
}

/** Replace /home/ahmedsk with ~ in any string */
function collapseHome(s: string): string {
  return s.replace(/\/home\/ahmedsk\b/g, '~')
}

/** Format tool input as a compact one-liner, excluding keys shown elsewhere */
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

function truncate(s: string, max: number): string {
  const flat = s.replace(/\n/g, ' ').replace(/\s+/g, ' ')
  return flat.length <= max ? flat : flat.slice(0, max) + '...'
}

/** Truncate but preserve newlines (for code display) */
function truncateCode(s: string, maxLines: number): string {
  const lines = s.split('\n')
  if (lines.length <= maxLines) return s
  return lines.slice(0, maxLines).join('\n') + `\n... (+${lines.length - maxLines} more lines)`
}

export function ProcessingPanel({
  projectId,
  projectName,
  repoPath,
  submittedTaskIds,
  tasks,
  onClose,
  onSessionCreated,
}: ProcessingPanelProps) {
  const [lines, setLines] = useState<OutputLine[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [waitingForInput, setWaitingForInput] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [sendingInput, setSendingInput] = useState(false)
  const [fileChanges, setFileChanges] = useState<ClaudeSessionFileChange[]>([])
  const [worktreeBranch, setWorktreeBranch] = useState<string | null>(null)
  const worktreeBranchRef = useRef<string | null>(null)
  // Track task statuses from stream (avoids Firestore listener race condition)
  const [streamTaskStatuses, setStreamTaskStatuses] = useState<Record<string, string>>({})
  const streamTaskStatusRef = useRef<Record<string, string>>({})
  const outputEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Ref-based flag prevents React StrictMode double-invocation from starting two fetches
  const isStartedRef = useRef(false)
  // Buffer for partial JSON lines from chunked stream
  const bufferRef = useRef('')
  // Session persistence refs
  const linesRef = useRef<OutputLine[]>([])
  const sessionIdRef = useRef<string | null>(null)
  const modelRef = useRef<string>('unknown')
  const processIdRef = useRef<string | null>(null)
  // File changes ref — latest value for async finalization
  const fileChangesRef = useRef<ClaudeSessionFileChange[]>([])
  // Flush refs for periodic transcript persistence
  const flushedCountRef = useRef(0)
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Waiting detection: timer to detect when Claude pauses (result event without process_exit)
  const waitingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addLine = useCallback((text: string, type: OutputLine['type'] = 'info', toolCategory?: ToolCategory) => {
    const line: OutputLine = { text, type, toolCategory }
    setLines((prev) => [...prev, line])
    linesRef.current = [...linesRef.current, line]
  }, [])

  const trackFileChange = useCallback((filePath: string, edit: ClaudeSessionFileEdit) => {
    setFileChanges(prev => {
      const idx = prev.findIndex(f => f.filePath === filePath)
      let next: ClaudeSessionFileChange[]
      if (idx >= 0) {
        next = [...prev]
        next[idx] = {
          ...next[idx],
          changeType: next[idx].changeType === 'created' ? 'created' : (edit.type === 'create' ? 'created' : 'modified'),
          edits: [...next[idx].edits, edit],
        }
      } else {
        next = [...prev, {
          filePath,
          shortPath: shortPath(filePath),
          changeType: edit.type === 'create' ? 'created' : 'modified',
          edits: [edit],
        }]
      }
      fileChangesRef.current = next
      return next
    })
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
      // Also persist file changes and worktree branch
      const updates: Partial<import('@/types').ClaudeSessionInput> = {}
      if (fileChangesRef.current.length > 0) updates.fileChanges = fileChangesRef.current
      if (worktreeBranchRef.current) updates.worktreeBranch = worktreeBranchRef.current
      if (Object.keys(updates).length > 0) {
        await claudeSessions.update(sid, updates).catch(() => {})
      }
    } catch {
      // Non-critical — next flush will retry
    }
  }, [])

  const handleStop = useCallback(async () => {
    // Abort the HTTP stream
    abortRef.current?.abort()
    setIsRunning(false)
    addLine('Session stopped by user.', 'system')

    // Clear flush interval
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current)
      flushTimerRef.current = null
    }

    // Final flush + mark as stopped
    if (sessionIdRef.current) {
      try {
        await flushTranscript()
        await claudeSessions.update(sessionIdRef.current, {
          status: 'stopped',
          completedAt: new Date(),
          model: modelRef.current,
          summary: 'Stopped by user',
          lineCount: linesRef.current.length,
          lastFlushAt: new Date(),
        })
      } catch {
        // Non-critical
      }
    }
  }, [addLine, flushTranscript])

  // Auto-scroll to bottom — always keep latest visible
  useEffect(() => {
    const el = scrollContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [lines])

  const processStreamLine = useCallback((raw: string) => {
    if (!raw.trim()) return

    try {
      const event = JSON.parse(raw)
      const eventType = event.type as string

      // Process ID from our API wrapper
      if (eventType === 'process_id' && event.processId) {
        processIdRef.current = event.processId
        // Store processId in Firestore session
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { processId: event.processId }).catch(() => {})
        }
        return
      }

      // System init message
      if (eventType === 'system' && event.subtype === 'init') {
        addLine(`Session started (model: ${event.model})`, 'system')
        // Capture model name and update session document
        if (event.model) {
          modelRef.current = event.model
          if (sessionIdRef.current) {
            claudeSessions.update(sessionIdRef.current, { model: event.model }).catch(() => {})
          }
        }
        return
      }

      // Assistant message with content — also clears waiting state (Claude resumed)
      if (eventType === 'assistant' && event.message?.content) {
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current)
          waitingTimerRef.current = null
        }
        setWaitingForInput(false)
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { waitingForInput: false }).catch(() => {})
        }
        const content = event.message.content as Array<{ type: string; text?: string; name?: string; input?: unknown }>
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            addLine(block.text, 'assistant')
            // Detect file changes from sub-agent text output (e.g. "📝 Write ~/path" or "✏️ Edit ~/path")
            const textLines = block.text.split('\n')
            for (const tl of textLines) {
              const writeMatch = tl.match(/📝\s*Write\s+(.+)/)
              if (writeMatch) {
                trackFileChange(writeMatch[1].trim(), { type: 'create' })
              }
              const editMatch = tl.match(/✏️\s*Edit\s+(.+)/)
              if (editMatch) {
                trackFileChange(editMatch[1].trim(), { type: 'edit' })
              }
              // Detect worktree/branch name from text
              if (!worktreeBranchRef.current) {
                const branchTextMatch = tl.match(/[Bb]ranch[:\s]+[`"']?(task\/[\w-]+)[`"']?/)
                if (branchTextMatch) { worktreeBranchRef.current = branchTextMatch[1]; setWorktreeBranch(branchTextMatch[1]) }
              }
            }
          }
          if (block.type === 'tool_use' && block.name) {
            const category = getToolCategory(block.name)
            const icon = toolIcons[category]
            const name = formatToolName(block.name)
            const inp = block.input as Record<string, unknown> | undefined

            // Format based on tool type
            if (category === 'read' && inp?.file_path) {
              const extra = formatToolInput(inp, ['file_path'])
              addLine(`${icon} Read ${shortPath(String(inp.file_path))}${extra ? ` (${extra})` : ''}`, 'tool-call', category)
            } else if (category === 'bash' && inp?.command) {
              addLine(`${icon} ${truncate(String(inp.command), 120)}`, 'tool-call', category)
            } else if (category === 'write' && inp?.file_path) {
              addLine(`${icon} Write ${shortPath(String(inp.file_path))}`, 'tool-call', category)
              // Diffs shown in File Changes panel only — not in transcript
              trackFileChange(String(inp.file_path), {
                type: 'create',
                content: typeof inp.content === 'string' ? inp.content : undefined,
              })
            } else if (category === 'edit' && inp?.file_path) {
              addLine(`${icon} Edit ${shortPath(String(inp.file_path))}`, 'tool-call', category)
              // Diffs shown in File Changes panel only — not in transcript
              trackFileChange(String(inp.file_path), {
                type: 'edit',
                oldString: typeof inp.old_string === 'string' ? inp.old_string : undefined,
                newString: typeof inp.new_string === 'string' ? inp.new_string : undefined,
              })
            } else if (category === 'search') {
              const target = inp?.pattern || inp?.path || ''
              const extra = formatToolInput(inp, ['pattern', 'path', 'output_mode'])
              addLine(`${icon} ${name} "${truncate(String(target), 60)}"${extra ? ` (${extra})` : ''}`, 'tool-call', category)
            } else if (category === 'agent') {
              const desc = inp?.description || ''
              addLine(`${icon} Agent: ${desc}`, 'tool-call', category)
              // Capture worktree branch when agent uses isolation: "worktree"
              if (inp?.isolation === 'worktree') {
                const promptText = typeof inp.prompt === 'string' ? inp.prompt : ''
                const branchMatch = promptText.match(/branch\s+(?:named?\s+)?[`"']?(task\/[\w-]+)[`"']?/i)
                if (branchMatch) { worktreeBranchRef.current = branchMatch[1]; setWorktreeBranch(branchMatch[1]) }
              }
            } else if (category === 'timer') {
              // Friendly timer messages
              const lower = block.name?.toLowerCase() || ''
              const notes = inp?.notes ? ` — ${truncate(String(inp.notes), 80)}` : ''
              const duration = inp?.duration ? ` (${inp.duration})` : ''
              if (lower.includes('start_timer')) {
                addLine(`${icon} Timer started${duration}${notes}`, 'tool-call', category)
              } else if (lower.includes('stop_timer')) {
                addLine(`${icon} Timer stopped${notes}`, 'tool-call', category)
              } else if (lower.includes('log_time')) {
                addLine(`${icon} Logged ${inp?.duration || '?'}${notes}`, 'tool-call', category)
              } else {
                addLine(`${icon} ${name}`, 'tool-call', category)
              }
            } else if (category === 'task-mgmt') {
              // Friendly task management messages
              const lower = block.name?.toLowerCase() || ''
              if (lower.includes('update_task_status')) {
                addLine(`${icon} Task → ${inp?.status || '?'}${inp?.comment ? ` — ${truncate(String(inp.comment), 80)}` : ''}`, 'tool-call', category)
                // Track task status from stream to avoid Firestore race condition
                if (inp?.taskId && inp?.status) {
                  const tid = String(inp.taskId)
                  const st = String(inp.status)
                  streamTaskStatusRef.current = { ...streamTaskStatusRef.current, [tid]: st }
                  setStreamTaskStatuses(prev => ({ ...prev, [tid]: st }))
                }
              } else if (lower.includes('add_task_comment')) {
                addLine(`${icon} Comment added${inp?.text ? `: ${truncate(String(inp.text), 100)}` : ''}`, 'tool-call', category)
              } else if (lower.includes('get_task_details')) {
                addLine(`${icon} Fetching task details`, 'tool-call', category)
              } else {
                addLine(`${icon} ${name}`, 'tool-call', category)
              }
            } else if (category === 'todo') {
              addLine(`${icon} Internal checklist updated`, 'tool-call', category)
            } else {
              const args = formatToolInput(inp)
              addLine(`${icon} ${name}${args ? `(${args})` : '()'}`, 'tool-call', category)
            }
          }
          if (block.type === 'tool_result') {
            const text = block.text || (typeof block.input === 'string' ? block.input : '')
            if (text) {
              addLine(truncate(text, 300), 'tool-result')
              // Detect file changes from sub-agent tool results
              const resultLines = String(text).split('\n')
              for (const rl of resultLines) {
                const writeMatch = rl.match(/📝\s*Write\s+(.+)/)
                if (writeMatch) trackFileChange(writeMatch[1].trim(), { type: 'create' })
                const editMatch = rl.match(/✏️\s*Edit\s+(.+)/)
                if (editMatch) trackFileChange(editMatch[1].trim(), { type: 'edit' })
              }
            }
          }
        }
        return
      }

      // Result event (end of a turn) — may indicate waiting for user input
      if (eventType === 'result') {
        if (event.result) {
          addLine(event.result, 'assistant')
        }
        // Start a 2s timer: if no process_exit follows, Claude is waiting for input
        if (waitingTimerRef.current) clearTimeout(waitingTimerRef.current)
        waitingTimerRef.current = setTimeout(() => {
          setWaitingForInput(true)
          if (sessionIdRef.current) {
            claudeSessions.update(sessionIdRef.current, { waitingForInput: true }).catch(() => {})
          }
        }, 2000)
        return
      }

      // Stderr from our wrapper
      if (eventType === 'stderr') {
        addLine(event.text, 'error')
        return
      }

      // Process exit from our wrapper
      if (eventType === 'process_exit') {
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current)
          waitingTimerRef.current = null
        }
        setWaitingForInput(false)
        if (sessionIdRef.current) {
          claudeSessions.update(sessionIdRef.current, { waitingForInput: false, processId: null }).catch(() => {})
        }
        addLine(`Process exited (code ${event.code})`, 'system')
        return
      }

      // Process error from our wrapper
      if (eventType === 'process_error') {
        addLine(`Process error: ${event.message}`, 'error')
        return
      }

      // Skip noise events
      if (['ping', 'rate_limit_event'].includes(eventType)) return

    } catch {
      // Not valid JSON — show as raw text
      if (raw.trim()) {
        addLine(raw, 'info')
      }
    }
  }, [addLine, trackFileChange])

  const handleSendInput = useCallback(async () => {
    const msg = userInput.trim()
    if (!msg || !processIdRef.current) return

    setSendingInput(true)
    addLine(msg, 'user')
    setUserInput('')
    setWaitingForInput(false)
    if (sessionIdRef.current) {
      claudeSessions.update(sessionIdRef.current, { waitingForInput: false }).catch(() => {})
    }

    try {
      // The /respond endpoint returns a stream (it spawns a new --resume process)
      const res = await fetch('/api/process-tasks/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId: processIdRef.current, message: msg }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text()
        addLine(`Response error: ${errText}`, 'error')
        return
      }

      // Read the response stream and process each line
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let respBuffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        respBuffer += chunk
        const parts = respBuffer.split('\n')
        respBuffer = parts.pop() || ''
        for (const part of parts) {
          processStreamLine(part)
        }
        if (linesRef.current.length - flushedCountRef.current >= 30) {
          flushTranscript()
        }
      }
      if (respBuffer.trim()) {
        processStreamLine(respBuffer)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        addLine(`Response error: ${err.message}`, 'error')
      }
    } finally {
      setSendingInput(false)
    }
  }, [userInput, addLine, processStreamLine, flushTranscript])

  // Start streaming when panel mounts — uses ref guard to prevent StrictMode double-start
  useEffect(() => {
    if (isStartedRef.current) return
    isStartedRef.current = true

    setIsRunning(true)
    addLine('Launching Claude Code...', 'system')

    const controller = new AbortController()
    abortRef.current = controller

    ;(async () => {
      // Create session document
      try {
        const taskResults: ClaudeSessionTaskResult[] = submittedTaskIds.map((tid) => {
          const task = tasks.find((t) => t.id === tid)
          return {
            taskId: tid,
            taskName: task?.name || tid,
            status: 'pending' as const,
            branchName: null,
          }
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
        // Start periodic transcript flushing every 5 seconds
        flushTimerRef.current = setInterval(flushTranscript, 5000)
      } catch {
        // Non-critical — session tracking is best-effort
      }

      try {
        const res = await fetch('/api/process-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            projectName,
            repoPath,
            taskIds: submittedTaskIds,
          }),
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const errText = await res.text()
          addLine(`API Error: ${errText}`, 'error')
          setIsRunning(false)
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Buffer and split by newlines — stream-json sends one JSON object per line
          bufferRef.current += chunk
          const parts = bufferRef.current.split('\n')
          // Keep the last part as buffer (might be incomplete)
          bufferRef.current = parts.pop() || ''
          for (const part of parts) {
            processStreamLine(part)
          }
          // Batch flush: if we have 30+ unflushed lines, flush now
          if (linesRef.current.length - flushedCountRef.current >= 30) {
            flushTranscript()
          }
        }

        // Process remaining buffer
        if (bufferRef.current.trim()) {
          processStreamLine(bufferRef.current)
          bufferRef.current = ''
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          addLine(`Connection error: ${err.message}`, 'error')
        }
      } finally {
        setIsRunning(false)
        setWaitingForInput(false)

        // Clear timers
        if (flushTimerRef.current) {
          clearInterval(flushTimerRef.current)
          flushTimerRef.current = null
        }
        if (waitingTimerRef.current) {
          clearTimeout(waitingTimerRef.current)
          waitingTimerRef.current = null
        }

        // Finalize session document
        if (sessionIdRef.current) {
          try {
            // Final flush to persist any remaining lines
            await flushTranscript()

            const allLines = linesRef.current
            const hasError = allLines.some((l) => l.type === 'error')
            // Extract summary from last assistant message
            const lastAssistant = [...allLines].reverse().find((l) => l.type === 'assistant')
            const summary = lastAssistant?.text?.slice(0, 500) || ''
            // Build task results — prefer stream-captured statuses (no Firestore lag)
            const taskResults: ClaudeSessionTaskResult[] = submittedTaskIds.map((tid) => {
              const task = tasks.find((t) => t.id === tid)
              const effectiveStatus = streamTaskStatusRef.current[tid] || task?.status
              let status: ClaudeSessionTaskResult['status'] = 'pending'
              if (effectiveStatus === 'in_progress') status = 'processing'
              else if (effectiveStatus === 'review' || effectiveStatus === 'done') status = 'completed'
              return {
                taskId: tid,
                taskName: task?.name || tid,
                status,
                branchName: null,
              }
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

  // Derive task progress from stream statuses (primary) + Firestore data (fallback)
  const taskStatuses = useMemo(() => {
    return submittedTaskIds.map((id) => {
      const task = tasks.find((t) => t.id === id)
      const name = task?.name || id
      // Prefer stream-captured status (no Firestore listener lag)
      const effectiveStatus = streamTaskStatuses[id] || task?.status
      if (effectiveStatus === 'in_progress') return { id, name, status: 'processing' as const }
      if (effectiveStatus === 'review' || effectiveStatus === 'done') return { id, name, status: 'completed' as const }
      return { id, name, status: 'pending' as const }
    })
  }, [submittedTaskIds, tasks, streamTaskStatuses])

  const completedCount = taskStatuses.filter((t) => t.status === 'completed').length

  // Minimized floating badge
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card shadow-2xl hover:shadow-lg transition-all"
      >
        {isRunning ? (
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        )}
        <span className="text-sm font-medium">
          Claude {isRunning ? 'Processing' : 'Done'} ({completedCount}/{submittedTaskIds.length})
        </span>
        <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-7xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30 shrink-0">
          <DialogHeader className="flex-row items-center gap-3 space-y-0">
            <Bot className="h-5 w-5 text-primary" />
            <DialogTitle className="text-base">
              Claude Code — {projectName}
            </DialogTitle>
            {isRunning && waitingForInput && (
              <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium">
                <MessageCircleQuestion className="h-3 w-3" />
                Waiting for your input
              </span>
            )}
            {isRunning && !waitingForInput && (
              <span className="flex items-center gap-1.5 text-xs text-blue-500 font-medium">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running
              </span>
            )}
            {!isRunning && isStartedRef.current && (
              <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </span>
            )}
          </DialogHeader>
          <div className="flex items-center gap-1">
            {isRunning && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleStop}
              >
                <Square className="h-3 w-3 mr-1 fill-current" />
                <span className="text-xs">Stop</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)}>
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Task sidebar */}
          <div className="w-56 shrink-0 border-r bg-muted/10 overflow-y-auto py-3 px-3 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
              Tasks ({completedCount}/{submittedTaskIds.length})
            </p>
            {taskStatuses.map((task) => (
              <div
                key={task.id}
                className={cn(
                  'flex items-center gap-2 py-1.5 px-2 rounded-md text-xs transition-colors',
                  task.status === 'processing' && 'bg-blue-50 dark:bg-blue-950/30',
                  task.status === 'completed' && 'bg-green-50 dark:bg-green-950/20',
                )}
              >
                {task.status === 'pending' && <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                {task.status === 'processing' && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />}
                {task.status === 'completed' && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                <span className={cn('truncate', task.status === 'completed' && 'text-muted-foreground')}>
                  {task.name}
                </span>
              </div>
            ))}
          </div>

          {/* Terminal + Input column */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Terminal output */}
            <div ref={scrollContainerRef} className="flex-1 bg-[#1e1e1e] overflow-y-auto p-4 font-mono text-sm leading-relaxed">
              {lines.map((line, i) => {
                // Tool call colors per category
                if (line.type === 'tool-call') {
                  const cat = line.toolCategory || 'other'
                  const colorMap: Record<ToolCategory, string> = {
                    read:       'text-cyan-400/90 border-cyan-400/30',
                    write:      'text-green-400/90 border-green-400/30',
                    edit:       'text-amber-400/90 border-amber-400/30',
                    bash:       'text-orange-400/90 border-orange-400/30',
                    search:     'text-blue-400/90 border-blue-400/30',
                    agent:      'text-purple-400/90 border-purple-400/30',
                    timer:      'text-emerald-300 border-emerald-400/40',
                    'task-mgmt':'text-indigo-400/90 border-indigo-400/30',
                    mcp:        'text-pink-400/90 border-pink-400/30',
                    todo:       'text-gray-600 border-gray-700/30',
                    other:      'text-yellow-400/90 border-yellow-400/30',
                  }

                  // Timer tools get a special card-style design
                  if (cat === 'timer') {
                    return (
                      <div key={i} className="my-1 mx-1 px-3 py-1.5 rounded-md bg-emerald-950/30 border border-emerald-500/20 text-emerald-300 text-[13px] flex items-center gap-2">
                        <span className="opacity-70">⏱️</span>
                        <span>{line.text.replace(/^⏱️\s*/, '')}</span>
                      </div>
                    )
                  }

                  // TodoWrite is dimmed — internal bookkeeping
                  if (cat === 'todo') {
                    return (
                      <div key={i} className="text-gray-600 text-xs py-0.5 pl-2 border-l border-gray-700/20 opacity-50">
                        {line.text}
                      </div>
                    )
                  }

                  return (
                    <div key={i} className={cn('break-words text-[13px] py-0.5 pl-2 border-l-2', colorMap[cat])}>
                      {line.text}
                    </div>
                  )
                }

                // Code diff lines
                if (line.type === 'code-add') {
                  return (
                    <pre key={i} className="text-xs py-0.5 pl-4 ml-2 bg-green-950/30 text-green-400/80 border-l-2 border-green-600/40 overflow-x-auto whitespace-pre">
                      {line.text.split('\n').map((l, j) => <div key={j}>+ {l}</div>)}
                    </pre>
                  )
                }
                if (line.type === 'code-remove') {
                  return (
                    <pre key={i} className="text-xs py-0.5 pl-4 ml-2 bg-red-950/30 text-red-400/80 border-l-2 border-red-600/40 overflow-x-auto whitespace-pre">
                      {line.text.split('\n').map((l, j) => <div key={j}>- {l}</div>)}
                    </pre>
                  )
                }

                // User message — chat bubble style
                if (line.type === 'user') {
                  return (
                    <div key={i} className="flex justify-end my-1">
                      <div className="max-w-[80%] px-3 py-1.5 rounded-lg bg-blue-600/90 text-white text-sm whitespace-pre-wrap">
                        <span className="text-[10px] font-medium text-blue-200 block mb-0.5">You:</span>
                        {line.text}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={i}
                    className={cn(
                      'break-words',
                      line.type === 'system' && 'text-blue-400 text-[13px] opacity-80 py-0.5',
                      line.type === 'assistant' && 'text-gray-200 py-1 whitespace-pre-wrap',
                      line.type === 'tool-result' && 'text-gray-500 text-[13px] py-0.5 pl-2 border-l-2 border-gray-600/30',
                      line.type === 'error' && 'text-red-400 py-0.5',
                      line.type === 'info' && 'text-gray-400 text-[13px] py-0.5',
                    )}
                  >
                    {line.text}
                  </div>
                )
              })}
              {isRunning && lines.length <= 1 && (
                <div className="flex items-center gap-2 text-gray-500 mt-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Waiting for Claude to respond (this may take 15-30 seconds)...</span>
                </div>
              )}
              <div ref={outputEndRef} />
            </div>

            {/* User input field — shown when Claude is waiting */}
            {waitingForInput && (
              <div className="shrink-0 border-t border-gray-700 bg-[#252525] px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageCircleQuestion className="h-4 w-4 text-amber-400 shrink-0" />
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInput() } }}
                    placeholder="Type your response..."
                    className="flex-1 bg-[#1e1e1e] border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                    disabled={sendingInput}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3"
                    onClick={handleSendInput}
                    disabled={!userInput.trim() || sendingInput}
                  >
                    {sendingInput ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* File Changes Panel — always visible */}
          <FileChangesPanel
            fileChanges={fileChanges}
            branchName={worktreeBranch}
            className="w-80 shrink-0 border-l border-gray-700"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
