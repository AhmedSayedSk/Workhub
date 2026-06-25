'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { imageGenSessions } from '@/lib/firestore'
import { ImageGenSession } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const ACTIVE_KEY = 'imageGenActiveSession'

// Manages image-generation sessions (threads) and the active selection. Each
// session carries its own standing prompt; a "Default" session is auto-created
// (seeded from the legacy global standing prompt) so nothing is lost.
export function useImageSessions(defaultStandingPrompt: string) {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<ImageGenSession[]>([])
  const [activeSessionId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const ensuredRef = useRef(false)
  const defaultPromptRef = useRef(defaultStandingPrompt)
  defaultPromptRef.current = defaultStandingPrompt

  const setActiveSessionId = useCallback((id: string | null) => {
    setActiveId(id)
    try {
      if (id) localStorage.setItem(ACTIVE_KEY, id)
    } catch {}
  }, [])

  // Initial load + ensure at least a Default session exists.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        let list = await imageGenSessions.getAll(user.uid)
        if (list.length === 0 && !ensuredRef.current) {
          ensuredRef.current = true
          await imageGenSessions.create({
            userId: user.uid,
            name: 'Default',
            standingPrompt: defaultPromptRef.current || '',
          })
          list = await imageGenSessions.getAll(user.uid)
        }
        if (cancelled) return
        setSessions(list)
        let stored: string | null = null
        try {
          stored = localStorage.getItem(ACTIVE_KEY)
        } catch {}
        const active = stored && list.some((s) => s.id === stored) ? stored : list[0]?.id || null
        setActiveId(active)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const refresh = useCallback(async () => {
    if (!user) return
    setSessions(await imageGenSessions.getAll(user.uid))
  }, [user])

  const createSession = useCallback(
    async (name: string, standingPrompt = ''): Promise<string | null> => {
      if (!user) return null
      const id = await imageGenSessions.create({ userId: user.uid, name: name.trim() || 'Untitled', standingPrompt })
      await refresh()
      setActiveSessionId(id)
      return id
    },
    [user, refresh, setActiveSessionId]
  )

  const renameSession = useCallback(async (id: string, name: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
    await imageGenSessions.update(id, { name: name.trim() || 'Untitled' })
  }, [])

  const setStandingPrompt = useCallback(async (id: string, standingPrompt: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, standingPrompt } : s)))
    await imageGenSessions.update(id, { standingPrompt })
  }, [])

  const touchSession = useCallback((id: string) => {
    imageGenSessions.touch(id).catch(() => {})
  }, [])

  const removeSession = useCallback(
    async (id: string) => {
      await imageGenSessions.delete(id)
      const remaining = sessions.filter((s) => s.id !== id)
      setSessions(remaining)
      if (activeSessionId === id) setActiveSessionId(remaining[0]?.id || null)
    },
    [sessions, activeSessionId, setActiveSessionId]
  )

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null

  return {
    sessions,
    activeSessionId,
    activeSession,
    loading,
    setActiveSessionId,
    createSession,
    renameSession,
    setStandingPrompt,
    touchSession,
    removeSession,
    refresh,
  }
}
