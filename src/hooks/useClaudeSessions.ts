'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { claudeSessions } from '@/lib/firestore'
import { ClaudeSession, ClaudeSessionInput } from '@/types'

export function useClaudeSessions(projectId: string) {
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [loading, setLoading] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      const result = await claudeSessions.getByProject(projectId)

      // Stale session detection: if running > 10 min AND lastFlushAt > 2 min stale → mark failed
      const now = Date.now()
      for (const s of result) {
        if (s.status !== 'running') continue
        const startedMs = s.startedAt.toMillis()
        const age = now - startedMs
        if (age < 10 * 60 * 1000) continue // less than 10 min old
        const lastFlush = s.lastFlushAt?.toMillis() ?? startedMs
        const staleTime = now - lastFlush
        if (staleTime > 2 * 60 * 1000) {
          // Auto-mark as failed
          claudeSessions.update(s.id, {
            status: 'failed',
            completedAt: new Date(),
          }).catch(() => {})
          s.status = 'failed'
        }
      }

      setSessions(result)
    } catch {
      // Silently fail — sessions are non-critical
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (projectId) {
      fetchSessions()
    }
  }, [projectId, fetchSessions])

  // Auto-poll every 10s when any session is running
  useEffect(() => {
    const hasRunning = sessions.some((s) => s.status === 'running')

    if (hasRunning) {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          claudeSessions.getByProject(projectId).then((result) => {
            // Apply stale detection on poll too
            const now = Date.now()
            for (const s of result) {
              if (s.status !== 'running') continue
              const startedMs = s.startedAt.toMillis()
              const age = now - startedMs
              if (age < 10 * 60 * 1000) continue
              const lastFlush = s.lastFlushAt?.toMillis() ?? startedMs
              const staleTime = now - lastFlush
              if (staleTime > 2 * 60 * 1000) {
                claudeSessions.update(s.id, {
                  status: 'failed',
                  completedAt: new Date(),
                }).catch(() => {})
                s.status = 'failed'
              }
            }
            setSessions(result)
          }).catch(() => {})
        }, 10_000)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [sessions, projectId])

  const createSession = useCallback(async (data: ClaudeSessionInput) => {
    const id = await claudeSessions.create(data)
    await fetchSessions()
    return id
  }, [fetchSessions])

  const updateSession = useCallback(async (id: string, data: Partial<ClaudeSessionInput>) => {
    await claudeSessions.update(id, data)
    await fetchSessions()
  }, [fetchSessions])

  return { sessions, loading, createSession, updateSession, refetch: fetchSessions }
}

export function useTaskSession(taskId: string | undefined, projectId: string) {
  const [session, setSession] = useState<ClaudeSession | null>(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSession = useCallback(async () => {
    if (!taskId || !projectId) {
      setSession(null)
      return
    }
    try {
      setLoading(true)
      const result = await claudeSessions.getByTaskId(taskId, projectId)
      setSession(result)
    } catch {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [taskId, projectId])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  // Poll every 3s when session is running
  useEffect(() => {
    if (session?.status === 'running') {
      if (!pollRef.current) {
        pollRef.current = setInterval(() => {
          if (!taskId || !projectId) return
          claudeSessions.getByTaskId(taskId, projectId).then(setSession).catch(() => {})
        }, 3000)
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [session?.status, taskId, projectId])

  return { session, loading, refetch: fetchSession }
}
