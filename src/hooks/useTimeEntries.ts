'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { timeEntries, projects, tasks, audit } from '@/lib/firestore'
import { TimeEntry, TimeEntryInput, Project, Task } from '@/types'
import { useAuth } from './useAuth'
import { useToast } from './useToast'

export function useTimeEntries(projectId?: string, startDate?: Date, endDate?: Date) {
  const [data, setData] = useState<TimeEntry[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({})
  const [tasksMap, setTasksMap] = useState<Record<string, Task>>({})
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  // Convert dates to timestamps for stable dependency comparison
  const startTimestamp = startDate?.getTime()
  const endTimestamp = endDate?.getTime()

  const fetchTimeEntries = useCallback(async () => {
    try {
      setLoading(true)

      let entries: TimeEntry[]
      if (startTimestamp && endTimestamp) {
        entries = await timeEntries.getByDateRange(
          new Date(startTimestamp),
          new Date(endTimestamp),
          projectId
        )
      } else if (projectId) {
        entries = await timeEntries.getAll(projectId)
      } else {
        entries = await timeEntries.getAll()
      }

      // Fetch related projects and tasks
      const [allProjects, allTasks] = await Promise.all([
        projects.getAll(user?.uid),
        tasks.getAll(),
      ])

      const pMap: Record<string, Project> = {}
      allProjects.forEach((p) => (pMap[p.id] = p))
      setProjectsMap(pMap)

      const tMap: Record<string, Task> = {}
      allTasks.forEach((t) => (tMap[t.id] = t))
      setTasksMap(tMap)

      // Filter entries to only accessible projects
      const accessibleIds = new Set(allProjects.map((p) => p.id))
      setData(entries.filter((e) => accessibleIds.has(e.projectId)))
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch time entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, startTimestamp, endTimestamp, user, toast])

  useEffect(() => {
    fetchTimeEntries()
  }, [fetchTimeEntries])

  const createTimeEntry = async (input: TimeEntryInput) => {
    try {
      const id = await timeEntries.create(input)
      audit({ type: 'time_entry', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: input.projectId, targetId: id, details: { durationMinutes: input.durationMinutes } })
      await fetchTimeEntries()
      toast({ description: 'Time entry created', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to create time entry', variant: 'destructive' })
      throw new Error('Failed to create time entry')
    }
  }

  const updateTimeEntry = async (id: string, input: Partial<TimeEntryInput>) => {
    try {
      await timeEntries.update(id, input)
      const existing = data.find((e) => e.id === id)
      audit({ type: 'time_entry', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: existing?.projectId, targetId: id })
      await fetchTimeEntries()
      toast({ description: 'Time entry updated', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update time entry', variant: 'destructive' })
      throw new Error('Failed to update time entry')
    }
  }

  const deleteTimeEntry = async (id: string) => {
    const previousData = data
    const existing = data.find((e) => e.id === id)

    // Optimistically remove from UI
    setData((prev) => prev.filter((e) => e.id !== id))

    try {
      await timeEntries.delete(id)
      audit({ type: 'time_entry', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: existing?.projectId, targetId: id })
    } catch {
      // Rollback on error
      setData(previousData)
      toast({ title: 'Error', description: 'Failed to delete time entry', variant: 'destructive' })
      throw new Error('Failed to delete time entry')
    }
  }

  return {
    timeEntries: data,
    projectsMap,
    tasksMap,
    loading,
    refetch: fetchTimeEntries,
    createTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
  }
}
