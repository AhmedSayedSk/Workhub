'use client'

import { useState } from 'react'
import { useToast } from './useToast'
import { tasks, projects } from '@/lib/firestore'
import { TaskStatus, TaskPriority, TaskType } from '@/types'

interface AIResponse {
  success: boolean
  data?: {
    suggestions?: string[]
    estimate?: number
    insight?: string
    response?: string
  }
  error?: string
}

export interface CreateTaskData {
  projectId: string
  name: string
  description?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  taskType?: 'task' | 'bug' | 'feature' | 'improvement' | 'documentation' | 'research'
  estimatedHours?: number
}

export function useAI() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const callAI = async (action: string, data: Record<string, unknown>): Promise<AIResponse | null> => {
    setLoading(true)
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      })

      const result = await response.json()

      if (!result.success) {
        toast({
          title: 'AI Error',
          description: result.error || 'Something went wrong',
          variant: 'destructive',
        })
        return null
      }

      return result
    } catch (error) {
      toast({
        title: 'AI Error',
        description: 'Failed to connect to AI service',
        variant: 'destructive',
      })
      return null
    } finally {
      setLoading(false)
    }
  }

  const getTaskBreakdown = async (
    featureName: string,
    featureDescription: string,
    projectContext?: string
  ): Promise<string[]> => {
    const result = await callAI('task_breakdown', {
      featureName,
      featureDescription,
      projectContext,
    })
    return result?.data?.suggestions || []
  }

  const getTimeEstimate = async (
    taskName: string,
    taskDescription: string,
    subtasks?: string[],
    historicalData?: { similarTasks: { name: string; actualHours: number }[] }
  ): Promise<number | null> => {
    const result = await callAI('time_estimate', {
      taskName,
      taskDescription,
      subtasks,
      historicalData,
    })
    return result?.data?.estimate || null
  }

  const getInsight = async (
    type: 'productivity' | 'project_health' | 'recommendations',
    insightData: {
      projects?: { name: string; status: string; completedTasks: number; totalTasks: number }[]
      timeEntries?: { date: string; hours: number; project: string }[]
      tasks?: { name: string; status: string; priority: string; createdAt: string }[]
    }
  ): Promise<string | null> => {
    const result = await callAI('insight', { type, insightData })
    return result?.data?.insight || null
  }

  const askQuestion = async (
    question: string,
    context?: string
  ): Promise<string | null> => {
    const result = await callAI('ask', { question, context })
    return result?.data?.response || null
  }

  const createTask = async (taskData: CreateTaskData): Promise<{ id: string; name: string; projectName: string } | null> => {
    try {
      // Verify project exists and get its name
      const project = await projects.getById(taskData.projectId)
      if (!project) {
        toast({
          title: 'Error',
          description: 'Project not found',
          variant: 'destructive',
        })
        return null
      }

      // Create the task directly via client-side Firestore
      const taskId = await tasks.create({
        featureId: '',
        projectId: taskData.projectId,
        name: taskData.name,
        description: taskData.description || '',
        status: 'todo' as TaskStatus,
        priority: (taskData.priority || 'medium') as TaskPriority,
        taskType: (taskData.taskType || 'task') as TaskType,
        estimatedHours: taskData.estimatedHours || 0,
      })

      toast({
        title: 'Task Created',
        description: `"${taskData.name}" added to ${project.name}`,
        variant: 'success',
      })

      return {
        id: taskId,
        name: taskData.name,
        projectName: project.name,
      }
    } catch (error) {
      console.error('Failed to create task:', error)
      toast({
        title: 'Error',
        description: 'Failed to create task',
        variant: 'destructive',
      })
      return null
    }
  }

  return {
    loading,
    getTaskBreakdown,
    getTimeEstimate,
    getInsight,
    askQuestion,
    createTask,
  }
}
