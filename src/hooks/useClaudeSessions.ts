'use client'

import { useState, useEffect, useCallback } from 'react'
import { claudeSessions } from '@/lib/firestore'
import { ClaudeSession, ClaudeSessionInput } from '@/types'

export function useClaudeSessions(projectId: string) {
  const [sessions, setSessions] = useState<ClaudeSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true)
      const result = await claudeSessions.getByProject(projectId)
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

  return { session, loading, refetch: fetchSession }
}
