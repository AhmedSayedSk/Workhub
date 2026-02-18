'use client'

import { useState, useMemo, useCallback } from 'react'
import { useFeatures, useTasks } from '@/hooks/useTasks'
import { Task, TaskInput, FeatureInput, TaskStatus } from '@/types'
import { FeatureList } from '@/components/features/FeatureList'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { TaskArchive } from '@/components/tasks/TaskArchive'
import { Confetti } from '@/components/ui/confetti'
import { Loader2, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ProjectTasksTabProps {
  projectId: string
  projectName: string
}

export function ProjectTasksTab({ projectId, projectName }: ProjectTasksTabProps) {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<{ active: boolean; x?: number; y?: number }>({ active: false })
  const [boardRefreshKey, setBoardRefreshKey] = useState(0)
  const [showArchive, setShowArchive] = useState(false)

  const handleBoardDataChanged = useCallback(() => {
    setBoardRefreshKey((k) => k + 1)
  }, [])

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
    archiveTask,
    unarchiveTask,
    permanentDeleteTask,
    setTaskWaiting,
    removeTaskWaiting,
    reorderTask,
  } = useTasks(projectId, undefined, projectName)

  // Separate active and archived tasks
  const { activeTasks, archivedTasks } = useMemo(() => {
    const active: Task[] = []
    const archived: Task[] = []
    tasks.forEach((t) => {
      if (t.archived) {
        archived.push(t)
      } else {
        active.push(t)
      }
    })
    return { activeTasks: active, archivedTasks: archived }
  }, [tasks])

  // Filter active tasks by selected feature
  const filteredTasks = useMemo(() => {
    if (selectedFeatureId === null) {
      return activeTasks
    }
    return activeTasks.filter((t) => t.featureId === selectedFeatureId)
  }, [activeTasks, selectedFeatureId])

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
    if (updates.status === 'done') {
      const task = tasks.find((t) => t.id === id)
      if (task && task.status !== 'done') {
        setConfetti({ active: true })
      }
    }
    await updateTask(id, updates as Partial<TaskInput>)
  }

  const handleArchiveTask = async (id: string) => {
    await archiveTask(id)
    if (selectedTaskId === id) {
      setSelectedTaskId(null)
    }
  }

  const handleSetTaskWaiting = async (id: string) => {
    await setTaskWaiting(id)
  }

  const handleRemoveTaskWaiting = async (id: string) => {
    await removeTaskWaiting(id)
  }

  const handleUnarchiveTask = async (id: string) => {
    await unarchiveTask(id)
  }

  const handlePermanentDeleteTask = async (id: string) => {
    await permanentDeleteTask(id)
  }

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id)
  }

  const handleReorderTask = async (taskId: string, newStatus: TaskStatus, newSortOrder: number) => {
    await reorderTask(taskId, newStatus, newSortOrder)
  }

  const handleTaskMovedToDone = (x: number, y: number) => {
    setConfetti({ active: true, x, y })
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
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      <Confetti active={confetti.active} originX={confetti.x} originY={confetti.y} onComplete={() => setConfetti({ active: false })} />
      {/* Features Sidebar */}
      <aside className="w-full lg:w-80 lg:min-w-80 lg:max-w-80 flex-shrink-0 border rounded-lg bg-card overflow-y-auto h-[540px] lg:h-auto">
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
      <div className="flex-1 min-w-0 relative">
        {/* Archive Button - floating card style */}
        <button
          onClick={() => setShowArchive(true)}
          className="absolute -top-11 right-0 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:shadow-md hover:bg-muted/40 dark:hover:bg-muted/20 transition-all duration-200 text-sm"
        >
          <Archive className="h-4 w-4" />
          <span>Archive</span>
          {archivedTasks.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full min-w-[20px] text-center">
              {archivedTasks.length}
            </span>
          )}
        </button>
        <TaskBoard
          tasks={filteredTasks}
          features={features}
          projectId={projectId}
          selectedFeatureId={selectedFeatureId}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onArchiveTask={handleArchiveTask}
          onSetTaskWaiting={handleSetTaskWaiting}
          onRemoveTaskWaiting={handleRemoveTaskWaiting}
          onSelectTask={handleSelectTask}
          onReorderTask={handleReorderTask}
          onTaskMovedToDone={handleTaskMovedToDone}
          refreshKey={boardRefreshKey}
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
        onArchiveTask={handleArchiveTask}
        onSetTaskWaiting={handleSetTaskWaiting}
        onRemoveTaskWaiting={handleRemoveTaskWaiting}
        onDataChanged={handleBoardDataChanged}
      />

      {/* Archive Section */}
      <TaskArchive
        tasks={archivedTasks}
        features={features}
        open={showArchive}
        onOpenChange={setShowArchive}
        onUnarchiveTask={handleUnarchiveTask}
        onPermanentDeleteTask={handlePermanentDeleteTask}
      />
    </div>
  )
}
