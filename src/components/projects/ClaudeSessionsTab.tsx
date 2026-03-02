'use client'

import { useState } from 'react'
import { useClaudeSessions } from '@/hooks/useClaudeSessions'
import { ClaudeSession, ClaudeSessionTaskResult } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Bot,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  Square,
  Trash2,
  Send,
  MessageCircleQuestion,
  StopCircle,
  GitBranch,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { claudeSessions } from '@/lib/firestore'
import { TranscriptViewer } from '@/components/tasks/TranscriptRenderer'

function formatDuration(startedAt: { toDate(): Date }, completedAt: { toDate(): Date } | null): string {
  if (!completedAt) return 'In progress...'
  const ms = completedAt.toDate().getTime() - startedAt.toDate().getTime()
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}h ${remMins}m`
}

function formatSessionDate(ts: { toDate(): Date }): string {
  const d = ts.toDate()
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function TaskResultBadge({ status }: { status: ClaudeSessionTaskResult['status'] }) {
  const styles = {
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    processing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <Badge className={cn('text-[10px] font-medium', styles[status])} variant="outline">
      {status}
    </Badge>
  )
}

function SessionStatusIcon({ status }: { status: ClaudeSession['status'] }) {
  if (status === 'running') return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
  if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'stopped') return <StopCircle className="h-5 w-5 text-orange-500" />
  return <XCircle className="h-5 w-5 text-red-500" />
}

function SessionCard({ session, repoPath, onRefresh }: { session: ClaudeSession; repoPath?: string | null; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(session.status === 'running')
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [cleanupWorktrees, setCleanupWorktrees] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [userInput, setUserInput] = useState('')
  const [sendingInput, setSendingInput] = useState(false)

  const completedTasks = session.taskResults.filter((t) => t.status === 'completed').length
  const isLive = session.status === 'running'
  const isWaiting = isLive && session.waitingForInput
  const hasBranches = repoPath && session.taskResults.some((tr) => !!tr.branchName)

  const handleSendInput = async () => {
    const msg = userInput.trim()
    if (!msg || !session.processId) return

    setSendingInput(true)
    // Add user message to transcript immediately
    const userLine = JSON.stringify({ text: msg, type: 'user' })
    await claudeSessions.appendTranscript(session.id, [userLine], session.lineCount + 1).catch(() => {})
    await claudeSessions.update(session.id, { waitingForInput: false }).catch(() => {})
    setUserInput('')

    try {
      // The /respond endpoint returns a stream (spawns --resume process)
      const res = await fetch('/api/process-tasks/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processId: session.processId, message: msg }),
      })

      if (!res.ok || !res.body) return

      // Read the response stream and append lines to transcript
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const newLines: string[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          if (!part.trim()) continue
          try {
            const evt = JSON.parse(part)
            if (evt.type === 'assistant' && evt.message?.content) {
              for (const block of evt.message.content) {
                if (block.type === 'text' && block.text) {
                  newLines.push(JSON.stringify({ text: block.text, type: 'assistant' }))
                }
              }
            } else if (evt.type === 'result' && evt.result) {
              newLines.push(JSON.stringify({ text: evt.result, type: 'assistant' }))
            }
          } catch { /* not JSON */ }
        }
      }

      // Flush accumulated lines to Firestore
      if (newLines.length > 0) {
        await claudeSessions.appendTranscript(session.id, newLines, session.lineCount + 1 + newLines.length).catch(() => {})
      }
    } catch {
      // Non-critical
    } finally {
      setSendingInput(false)
    }
  }

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setStopping(true)
    try {
      await claudeSessions.update(session.id, {
        status: 'stopped',
        completedAt: new Date(),
        summary: 'Stopped by user',
      })
      onRefresh()
    } catch {
      // Non-critical
    } finally {
      setStopping(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      // Clean up worktrees/branches if requested
      if (cleanupWorktrees && repoPath) {
        const branches = session.taskResults
          .map((tr) => tr.branchName)
          .filter((b): b is string => !!b)
        if (branches.length > 0) {
          await fetch('/api/cleanup-worktrees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoPath, branches }),
          })
        }
      }
      await claudeSessions.delete(session.id)
      onRefresh()
    } catch {
      // Non-critical
    } finally {
      setDeleting(false)
      setCleanupWorktrees(false)
      setConfirmDelete(false)
    }
  }

  return (
    <>
      <Card className={cn('overflow-hidden', isLive && 'ring-1 ring-blue-400/50')}>
        <div className="flex items-start">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 text-left"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <SessionStatusIcon status={session.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate max-w-[300px]" title={session.taskResults.map((t) => t.taskName).join(', ')}>
                      {session.taskResults.length === 1
                        ? session.taskResults[0].taskName
                        : `${session.taskResults[0]?.taskName || 'Session'} +${session.taskResults.length - 1} more`}
                    </span>
                    {session.model && session.model !== 'unknown' && (
                      <Badge variant="outline" className="text-[10px]">
                        {session.model}
                      </Badge>
                    )}
                    {isWaiting ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-amber-300 text-amber-600 dark:border-amber-500 dark:text-amber-400"
                      >
                        <MessageCircleQuestion className="h-2.5 w-2.5 mr-1" />
                        Waiting for input
                      </Badge>
                    ) : isLive ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-blue-300 text-blue-600 dark:border-blue-500 dark:text-blue-400 animate-pulse"
                      >
                        Live
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          session.status === 'completed' && 'border-green-300 text-green-600 dark:border-green-500 dark:text-green-400',
                          session.status === 'stopped' && 'border-orange-300 text-orange-600 dark:border-orange-500 dark:text-orange-400',
                          session.status === 'failed' && 'border-red-300 text-red-600 dark:border-red-500 dark:text-red-400',
                        )}
                      >
                        {session.status}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatSessionDate(session.startedAt)}
                    </span>
                    <span>{formatDuration(session.startedAt, session.completedAt)}</span>
                    <span>{completedTasks}/{session.taskResults.length} completed</span>
                  </div>
                  {session.worktreeBranch && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-purple-600 dark:text-purple-400">
                      <GitBranch className="h-3 w-3 shrink-0" />
                      <code className="truncate">{session.worktreeBranch}</code>
                    </div>
                  )}
                </div>
                {expanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </div>
            </CardContent>
          </button>
          {/* Action buttons */}
          <div className="flex items-center gap-1 pr-3 pt-4 shrink-0">
            {isLive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleStop}
                disabled={stopping}
                title="Stop session"
              >
                {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
              title="Delete session"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="border-t px-4 pb-4 space-y-3">
            {/* Task results table */}
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Task Results</p>
              <div className="space-y-1.5">
                {session.taskResults.map((tr) => (
                  <div key={tr.taskId} className="flex items-center gap-2 text-sm py-1 px-2 rounded-md bg-muted/30">
                    <span className="flex-1 truncate">{tr.taskName}</span>
                    <TaskResultBadge status={tr.status} />
                    {tr.branchName && (
                      <code className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {tr.branchName}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {session.summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.summary}</p>
              </div>
            )}

            {/* Inline transcript for running sessions, button for completed */}
            {isLive && session.transcript.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Live Transcript</p>
                <TranscriptViewer
                  transcript={session.transcript}
                  fileChanges={session.fileChanges}
                  branchName={session.worktreeBranch}
                  autoScroll
                  className="max-h-[40vh]"
                />
              </div>
            )}

            {/* Input field when Claude is waiting for user response */}
            {isWaiting && session.processId && (
              <div className="flex items-center gap-2 p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
                <MessageCircleQuestion className="h-4 w-4 text-amber-500 shrink-0" />
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendInput() } }}
                  placeholder="Type your response to Claude..."
                  className="flex-1 bg-transparent border border-input rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
            )}

            {!isLive && session.transcript.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setTranscriptOpen(true)}
              >
                <FileText className="h-3.5 w-3.5" />
                View Transcript ({session.lineCount} lines)
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Transcript Dialog */}
      <Dialog open={transcriptOpen} onOpenChange={setTranscriptOpen}>
        <DialogContent className="max-w-6xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-3 border-b bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bot className="h-5 w-5 text-primary" />
              Session Transcript
              <span className="text-xs text-muted-foreground font-normal">
                {formatSessionDate(session.startedAt)} — {session.lineCount} lines
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden p-1">
            <TranscriptViewer
              transcript={session.transcript}
              fileChanges={session.fileChanges}
              branchName={session.worktreeBranch}
              className="h-full max-h-none"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(open) => { setConfirmDelete(open); if (!open) setCleanupWorktrees(false) }}
        title="Delete AI Session"
        description={
          <div className="space-y-3">
            <p>This will permanently delete this AI session and its transcript. This action cannot be undone.</p>
            {hasBranches && (
              <label className="flex items-start gap-2 cursor-pointer rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={cleanupWorktrees}
                  onCheckedChange={(checked) => setCleanupWorktrees(checked === true)}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <span className="font-medium">Also remove git worktrees & branches</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {session.taskResults.filter((tr) => tr.branchName).map((tr) => (
                      <code key={tr.taskId} className="block">{tr.branchName}</code>
                    ))}
                  </div>
                </div>
              </label>
            )}
          </div>
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

interface ClaudeSessionsTabProps {
  projectId: string
  repoPath?: string | null
}

export function ClaudeSessionsTab({ projectId, repoPath }: ClaudeSessionsTabProps) {
  const { sessions, loading, refetch } = useClaudeSessions(projectId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Bot className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm font-medium">No AI sessions yet</p>
        <p className="text-xs mt-1">Process tasks with Claude Code to see session history here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-1">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} repoPath={repoPath} onRefresh={refetch} />
      ))}
    </div>
  )
}
