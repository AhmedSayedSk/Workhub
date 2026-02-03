'use client'

import { useState, useMemo, useEffect } from 'react'
import { useFeatures, useTasks } from '@/hooks/useTasks'
import { Task, TaskInput, FeatureInput } from '@/types'
import { FeatureList } from '@/components/features/FeatureList'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { Loader2 } from 'lucide-react'

interface ProjectTasksTabProps {
  projectId: string
  projectName: string
}

export function ProjectTasksTab({ projectId, projectName }: ProjectTasksTabProps) {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const {
    features,
    loading: featuresLoading,
    createFeature,
    updateFeature,
    deleteFeature,
  } = useFeatures(projectId)

  const {
    tasks,
    loading: tasksLoading,
    createTask,
    updateTask,
    deleteTask,
  } = useTasks(projectId)

  // Filter tasks by selected feature
  const filteredTasks = useMemo(() => {
    if (selectedFeatureId === null) {
      return tasks
    }
    return tasks.filter((t) => t.featureId === selectedFeatureId)
  }, [tasks, selectedFeatureId])

  // Derive selectedTask from tasks list - this ensures it stays in sync
  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null
    return tasks.find((t) => t.id === selectedTaskId) || null
  }, [tasks, selectedTaskId])

  const handleCreateFeature = async (data: FeatureInput) => {
    await createFeature(data)
  }

  const handleUpdateFeature = async (id: string, data: Partial<FeatureInput>) => {
    await updateFeature(id, data)
  }

  const handleDeleteFeature = async (id: string) => {
    await deleteFeature(id)
  }

  const handleCreateTask = async (data: TaskInput) => {
    await createTask({
      ...data,
      // If a feature is selected, use it. Otherwise use whatever was provided
      featureId: selectedFeatureId || data.featureId,
    })
  }

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    await updateTask(id, updates as Partial<TaskInput>)
    // selectedTask will automatically update via useMemo when tasks refetch
  }

  const handleDeleteTask = async (id: string) => {
    await deleteTask(id)
    if (selectedTaskId === id) {
      setSelectedTaskId(null)
    }
  }

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id)
  }

  const handleCloseTaskDetail = (open: boolean) => {
    if (!open) {
      setSelectedTaskId(null)
    }
  }

  const loading = featuresLoading || tasksLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-6 min-h-[600px]">
      {/* Features Sidebar */}
      <aside className="w-full lg:w-80 lg:min-w-80 lg:max-w-80 flex-shrink-0 border rounded-lg bg-card overflow-hidden h-[540px]">
        <FeatureList
          features={features}
          tasks={tasks}
          projectId={projectId}
          selectedFeatureId={selectedFeatureId}
          onSelectFeature={setSelectedFeatureId}
          onCreateFeature={handleCreateFeature}
          onUpdateFeature={handleUpdateFeature}
          onDeleteFeature={handleDeleteFeature}
        />
      </aside>

      {/* Task Board */}
      <div className="flex-1 min-w-0">
        <TaskBoard
          tasks={filteredTasks}
          features={features}
          projectId={projectId}
          selectedFeatureId={selectedFeatureId}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onSelectTask={handleSelectTask}
        />
      </div>

      {/* Task Detail Modal */}
      <TaskDetail
        task={selectedTask}
        projectId={projectId}
        projectName={projectName}
        features={features}
        open={!!selectedTask}
        onOpenChange={handleCloseTaskDetail}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
      />
    </div>
  )
}
