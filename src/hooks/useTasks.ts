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
      toast({ title: 'Success', description: 'Feature created' })
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
      toast({ title: 'Success', description: 'Feature updated' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update feature', variant: 'destructive' })
      throw new Error('Failed to update feature')
    }
  }

  const deleteFeature = async (id: string) => {
    try {
      await features.delete(id)
      await fetchFeatures()
      toast({ title: 'Success', description: 'Feature deleted' })
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
      toast({ title: 'Success', description: 'Task created' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create task', variant: 'destructive' })
      throw new Error('Failed to create task')
    }
  }

  const updateTask = async (id: string, input: Partial<TaskInput>) => {
    try {
      await tasks.update(id, input)
      await fetchTasks()
    } catch {
      toast({ title: 'Error', description: 'Failed to update task', variant: 'destructive' })
      throw new Error('Failed to update task')
    }
  }

  const deleteTask = async (id: string) => {
    try {
      await tasks.delete(id)
      await fetchTasks()
      toast({ title: 'Success', description: 'Task deleted' })
    } catch {
      toast({ title: 'Error', description: 'Failed to delete task', variant: 'destructive' })
      throw new Error('Failed to delete task')
    }
  }

  return {
    tasks: data,
    loading,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
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
      toast({ title: 'Success', description: 'Subtask created' })
      return id
    } catch {
      toast({ title: 'Error', description: 'Failed to create subtask', variant: 'destructive' })
      throw new Error('Failed to create subtask')
    }
  }

  const updateSubtask = async (id: string, input: Partial<SubtaskInput>) => {
    try {
      await subtasks.update(id, input)
      await fetchSubtasks()
    } catch {
      toast({ title: 'Error', description: 'Failed to update subtask', variant: 'destructive' })
      throw new Error('Failed to update subtask')
    }
  }

  const deleteSubtask = async (id: string) => {
    try {
      await subtasks.delete(id)
      await fetchSubtasks()
      toast({ title: 'Success', description: 'Subtask deleted' })
    } catch {
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
