'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { taskQuestions } from '@/lib/firestore'
import { TaskQuestion } from '@/types'
import { useToast } from './useToast'
import { useAuth } from './useAuth'

export function useTaskQuestions(taskId?: string) {
  const [data, setData] = useState<TaskQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  const fetchQuestions = useCallback(async () => {
    if (!taskId) {
      setData([])
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const result = await taskQuestions.getByTaskId(taskId)
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch questions',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [taskId, toast])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const answerQuestion = async (id: string, answer: string) => {
    if (!user?.uid) return
    const previous = data
    const now = Timestamp.now()
    // Optimistic update — set answer + timestamps immediately so the UI reflects
    // the saved state without a refetch (refetching toggles `loading` and would
    // unmount the dialog, causing a visible flash).
    setData((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, answer, answeredBy: user.uid, answeredAt: now }
          : q
      )
    )
    try {
      await taskQuestions.answer(id, answer, user.uid)
    } catch {
      setData(previous)
      toast({ title: 'Error', description: 'Failed to save answer', variant: 'destructive' })
    }
  }

  const unansweredCount = data.filter((q) => q.answer === null).length

  return {
    questions: data,
    loading,
    unansweredCount,
    answerQuestion,
    refetch: fetchQuestions,
  }
}

// Counts by task: returns total + unanswered counts per task.
// Used by kanban card indicators.
export function useTaskQuestionCounts(taskIds: string[], refreshTrigger?: number) {
  const [counts, setCounts] = useState<Record<string, { total: number; unanswered: number }>>({})
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (taskIds.length === 0) {
      setCounts({})
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      // Batched 'in' query — Firestore caps at 30 per query
      const idSet = new Set(taskIds)
      const next: Record<string, { total: number; unanswered: number }> = {}
      // Pull every question whose taskId is in the visible list. We fetch
      // per-batch because Firestore 'in' has a 30-id ceiling.
      const ids = Array.from(idSet)
      const { db } = await import('@/lib/firebase')
      const { collection, query, where, getDocs } = await import('firebase/firestore')
      for (let i = 0; i < ids.length; i += 30) {
        const slice = ids.slice(i, i + 30)
        const snap = await getDocs(query(collection(db, 'taskQuestions'), where('taskId', 'in', slice)))
        snap.forEach((doc) => {
          const data = doc.data() as TaskQuestion
          const entry = next[data.taskId] || { total: 0, unanswered: 0 }
          entry.total += 1
          if (data.answer === null) entry.unanswered += 1
          next[data.taskId] = entry
        })
      }
      setCounts(next)
    } catch {
      setCounts({})
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIds.join(','), refreshTrigger])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { counts, loading, refetch: fetchCounts }
}

// Aggregate hook: returns the full list of unanswered questions across all tasks.
// Used by the dashboard "tasks waiting for your answers" card.
export function useUnansweredQuestions(refreshTrigger?: number) {
  const [questions, setQuestions] = useState<TaskQuestion[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true)
      const result = await taskQuestions.getAllUnanswered()
      setQuestions(result)
    } catch {
      setQuestions([])
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const countsByTask: Record<string, number> = {}
  for (const q of questions) {
    countsByTask[q.taskId] = (countsByTask[q.taskId] || 0) + 1
  }

  return { unansweredQuestions: questions, countsByTask, loading, refetch: fetchAll }
}
