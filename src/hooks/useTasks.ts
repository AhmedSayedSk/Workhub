'use client'

import { useState, useEffect, useCallback } from 'react'
import { tasks, subtasks, features } from '@/lib/firestore'
import { Task, TaskInput, Subtask, SubtaskInput, Feature, FeatureInput } from '@/types'
import { useToast } from './useToast'

export function useFeatures(projectId?: string) {
  const [data, setData] = useState<Feature[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchFeatures = useCallback(async () => {
    try {
      setLoading(true)
      const result = await features.getAll(projectId)
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch features',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    fetchFeatures()
  }, [fetchFeatures])

  const createFeature = async (input: FeatureInput) => {
    try {
      const id = await features.create(input)
      await fetchFeatures()
      toast({ title: 'Success', description: 'Feature created', variant: 'success' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create feature', variant: 'destructive' })
      throw new Error('Failed to create feature')
    }
  }

  const updateFeature = async (id: string, input: Partial<FeatureInput>) => {
    try {
      await features.update(id, input)
      await fetchFeatures()
      toast({ title: 'Success', description: 'Feature updated', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update feature', variant: 'destructive' })
      throw new Error('Failed to update feature')
    }
  }

  const deleteFeature = async (id: string) => {
    try {
      await features.delete(id)
      await fetchFeatures()
      toast({ title: 'Success', description: 'Feature deleted', variant: 'success' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete feature', variant: 'destructive' })
      throw new Error('Failed to delete feature')
    }
  }

  return {
    features: data,
    loading,
    refetch: fetchFeatures,
    createFeature,
    updateFeature,
    deleteFeature,
  }
}

export function useTasks(projectId?: string, featureId?: string) {
  const [data, setData] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true)
      const result = await tasks.getAll(featureId, projectId)
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, featureId, toast])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const createTask = async (input: TaskInput) => {
    try {
      const id = await tasks.create(input)
      await fetchTasks()
      toast({ title: 'Success', description: 'Task created', variant: 'success' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create task', variant: 'destructive' })
      throw new Error('Failed to create task')
    }
  }

  const updateTask = async (id: string, input: Partial<TaskInput>) => {
    // Optimistic update - update local state immediately
    setData((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, ...input } as Task : t
      )
    )

    try {
      await tasks.update(id, input)
    } catch {
      // Revert on error by refetching
      await fetchTasks()
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' })
      throw new Error('Failed to update task')
    }
  }

  const deleteTask = async (id: string) => {
    // Optimistic delete - remove from local state immediately
    const previousData = data
    setData((prev) => prev.filter((t) => t.id !== id))

    try {
      await tasks.delete(id)
    } catch {
      // Revert on error
      setData(previousData)
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' })
      throw new Error('Failed to delete task')
    }
  }

  const reorderTask = async (id: string, newStatus: string, newSortOrder: number) => {
    // Optimistic update
    setData((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: newStatus as Task['status'], sortOrder: newSortOrder } : t
      )
    )

    try {
      await tasks.reorder(id, newStatus, newSortOrder)
    } catch {
      // Revert on error
      await fetchTasks()
      toast({ title: 'Error', description: 'Failed to reorder task', variant: 'destructive' })
      throw new Error('Failed to reorder task')
    }
  }

  return {
    tasks: data,
    loading,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTask,
  }
}

export function useSubtasks(taskId?: string) {
  const [data, setData] = useState<Subtask[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchSubtasks = useCallback(async () => {
    if (!taskId) {
      setData([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const result = await subtasks.getAll(taskId)
      setData(result)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to fetch subtasks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [taskId, toast])

  useEffect(() => {
    fetchSubtasks()
  }, [fetchSubtasks])

  const createSubtask = async (input: SubtaskInput) => {
    try {
      const id = await subtasks.create(input)
      await fetchSubtasks()
      toast({ title: 'Success', description: 'Subtask created', variant: 'success' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create subtask', variant: 'destructive' })
      throw new Error('Failed to create subtask')
    }
  }

  const updateSubtask = async (id: string, input: Partial<SubtaskInput>) => {
    // Optimistic update - update local state immediately
    const previousData = data
    setData((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...input } as Subtask : s))
    )

    try {
      await subtasks.update(id, input)
    } catch {
      // Revert on error
      setData(previousData)
      toast({ title: 'Error', description: 'Failed to update subtask', variant: 'destructive' })
      throw new Error('Failed to update subtask')
    }
  }

  const deleteSubtask = async (id: string) => {
    // Optimistic delete - remove from local state immediately
    const previousData = data
    setData((prev) => prev.filter((s) => s.id !== id))

    try {
      await subtasks.delete(id)
    } catch {
      // Revert on error
      setData(previousData)
      toast({ title: 'Error', description: 'Failed to delete subtask', variant: 'destructive' })
      throw new Error('Failed to delete subtask')
    }
  }

  return {
    subtasks: data,
    loading,
    refetch: fetchSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
  }
}

// Hook to fetch subtask counts for multiple tasks at once
export function useSubtaskCounts(taskIds: string[]) {
  const [counts, setCounts] = useState<Record<string, { total: number; completed: number }>>({})
  const [loading, setLoading] = useState(true)

  const fetchCounts = useCallback(async () => {
    if (taskIds.length === 0) {
      setCounts({})
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const allSubtasks = await subtasks.getByTaskIds(taskIds)

      // Group by taskId and count
      const newCounts: Record<string, { total: number; completed: number }> = {}
      allSubtasks.forEach((subtask) => {
        if (!newCounts[subtask.taskId]) {
          newCounts[subtask.taskId] = { total: 0, completed: 0 }
        }
        newCounts[subtask.taskId].total++
        if (subtask.status === 'done') {
          newCounts[subtask.taskId].completed++
        }
      })

      setCounts(newCounts)
    } catch (error) {
      console.error('Failed to fetch subtask counts:', error)
    } finally {
      setLoading(false)
    }
  }, [taskIds.join(',')])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  return { counts, loading, refetch: fetchCounts }
}
