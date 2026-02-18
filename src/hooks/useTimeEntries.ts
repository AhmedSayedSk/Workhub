'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { timeEntries, projects, tasks } from '@/lib/firestore'
import { TimeEntry, TimeEntryInput, Project, Task } from '@/types'
import { useToast } from './useToast'

export function useTimeEntries(projectId?: string, startDate?: Date, endDate?: Date) {
  const [data, setData] = useState<TimeEntry[]>([])
  const [projectsMap, setProjectsMap] = useState<Record<string, Project>>({})
  const [tasksMap, setTasksMap] = useState<Record<string, Task>>({})
  const [loading, setLoading] = useState(true)
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
        projects.getAll(),
        tasks.getAll(),
      ])

      const pMap: Record<string, Project> = {}
      allProjects.forEach((p) => (pMap[p.id] = p))
      setProjectsMap(pMap)

      const tMap: Record<string, Task> = {}
      allTasks.forEach((t) => (tMap[t.id] = t))
      setTasksMap(tMap)

      setData(entries)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch time entries',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, startTimestamp, endTimestamp, toast])

  useEffect(() => {
    fetchTimeEntries()
  }, [fetchTimeEntries])

  const createTimeEntry = async (input: TimeEntryInput) => {
    try {
      await timeEntries.create(input)
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
      await fetchTimeEntries()
      toast({ description: 'Time entry updated', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update time entry', variant: 'destructive' })
      throw new Error('Failed to update time entry')
    }
  }

  const deleteTimeEntry = async (id: string) => {
    const previousData = data

    // Optimistically remove from UI
    setData((prev) => prev.filter((e) => e.id !== id))

    try {
      await timeEntries.delete(id)
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
