'use client'

import { useState, useMemo, useCallback } from 'react'
import { useFeatures, useTasks } from '@/hooks/useTasks'
import { useMembers } from '@/hooks/useMembers'
import { Task, TaskInput, FeatureInput, TaskStatus } from '@/types'
import { FeatureList } from '@/components/features/FeatureList'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { TaskArchive } from '@/components/tasks/TaskArchive'
import { Confetti } from '@/components/ui/confetti'
import { Loader2, Archive, Users, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { MemberAvatar } from '@/components/members/MemberAvatar'
import { useAI } from '@/hooks/useAI'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { notifyByEmail } from '@/lib/email/notify'

interface ProjectTasksTabProps {
  projectId: string
  projectName: string
  projectOwnerId?: string
  projectOwnerEmail?: string
  projectOwnerName?: string
  canArchive?: boolean
}

export function ProjectTasksTab({ projectId, projectName, projectOwnerId, projectOwnerEmail, projectOwnerName, canArchive = true }: ProjectTasksTabProps) {
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [confetti, setConfetti] = useState<{ active: boolean; x?: number; y?: number }>({ active: false })
  const [boardRefreshKey, setBoardRefreshKey] = useState(0)
  const [showArchive, setShowArchive] = useState(false)
  const [filterAssigneeId, setFilterAssigneeId] = useState<string | null>(null)
  const [memberFilterOpen, setMemberFilterOpen] = useState(false)
  const { suggestTaskIcon } = useAI()
  const { settings } = useSettings()
  const { user } = useAuth()

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

  const { members: allMembers } = useMembers()

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

  // Filter active tasks by selected feature and assignee
  const filteredTasks = useMemo(() => {
    let list = activeTasks
    if (selectedFeatureId !== null) {
      list = list.filter((t) => t.featureId === selectedFeatureId)
    }
    if (filterAssigneeId) {
      list = list.filter((t) => (t.assigneeIds || []).includes(filterAssigneeId))
    }
    return list
  }, [activeTasks, selectedFeatureId, filterAssigneeId])

  const filterAssignee = useMemo(
    () => allMembers.find((m) => m.id === filterAssigneeId) || null,
    [allMembers, filterAssigneeId],
  )

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
    const taskId = await createTask({
      ...data,
      // If a feature is selected, use it. Otherwise use whatever was provided
      featureId: selectedFeatureId || data.featureId,
    })

    // Non-blocking: suggest an icon via AI if enabled
    if (taskId && settings?.aiEnabled) {
      suggestTaskIcon(data.name, data.description, data.taskType).then((iconName) => {
        if (iconName) {
          updateTask(taskId, { icon: iconName } as Partial<TaskInput>)
        }
      })
    }
  }

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    const taskBefore = tasks.find((t) => t.id === id)
    const movingToDone = updates.status === 'done' && taskBefore && taskBefore.status !== 'done'
    if (movingToDone) {
      setConfetti({ active: true })
    }
    await updateTask(id, updates as Partial<TaskInput>)

    // Email project owner when a task moves to "done" by someone other than the owner
    if (
      movingToDone &&
      projectOwnerId &&
      projectOwnerEmail &&
      user &&
      user.uid !== projectOwnerId &&
      taskBefore
    ) {
      void notifyByEmail({
        type: 'task_completed',
        payload: {
          recipients: [{ email: projectOwnerEmail, name: projectOwnerName || projectOwnerEmail }],
          actorName: user.displayName || user.email || 'Someone',
          taskName: taskBefore.name,
          projectName,
          projectId,
          taskId: id,
        },
      })
    }

    // If task has no icon and AI is enabled, suggest one after edit
    if (settings?.aiEnabled) {
      const task = tasks.find((t) => t.id === id)
      if (task && !task.icon) {
        const name = (updates.name as string) || task.name
        const description = (updates.description as string) || task.description
        const taskType = (updates.taskType as string) || task.taskType
        suggestTaskIcon(name, description, taskType).then((iconName) => {
          if (iconName) {
            updateTask(id, { icon: iconName } as Partial<TaskInput>)
          }
        })
      }
    }
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
      <aside className="w-full lg:w-80 lg:min-w-80 lg:max-w-80 flex-shrink-0 border rounded-lg bg-card flex flex-col h-[540px] lg:h-auto">
        <div className="flex-1 min-h-0 overflow-y-auto">
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
        </div>
      </aside>

      {/* Task Board */}
      <div className="flex-1 min-w-0 relative">
        {/* Floating actions row */}
        <div className="absolute -top-11 right-0 z-10 flex items-center gap-2">
          {/* Member filter */}
          <Popover open={memberFilterOpen} onOpenChange={setMemberFilterOpen}>
            <PopoverTrigger asChild>
              <button
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card hover:shadow-md hover:bg-muted dark:hover:bg-muted/70 transition-all duration-200 text-sm ${
                  filterAssignee ? 'text-foreground border-primary/40' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {filterAssignee ? (
                  <MemberAvatar member={filterAssignee} size="sm" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                <span>{filterAssignee ? filterAssignee.name : 'All members'}</span>
                {filterAssignee && (
                  <X
                    className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFilterAssigneeId(null)
                    }}
                  />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Filter by member..." />
                <CommandList>
                  <CommandEmpty>
                    {allMembers.length === 0 ? 'No team members found.' : 'No matching members.'}
                  </CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      value="__all__"
                      onSelect={() => {
                        setFilterAssigneeId(null)
                        setMemberFilterOpen(false)
                      }}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">All members</p>
                    </CommandItem>
                    {allMembers.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={`${m.name} ${m.email}`}
                        onSelect={() => {
                          setFilterAssigneeId(m.id)
                          setMemberFilterOpen(false)
                        }}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <MemberAvatar member={m} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{m.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Archive button */}
          {canArchive && (
            <button
              onClick={() => setShowArchive(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-muted-foreground hover:text-foreground hover:shadow-md hover:bg-muted dark:hover:bg-muted/70 transition-all duration-200 text-sm"
            >
              <Archive className="h-4 w-4" />
              <span>Archive</span>
              {archivedTasks.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-muted rounded-full min-w-[20px] text-center">
                  {archivedTasks.length}
                </span>
              )}
            </button>
          )}
        </div>
        <TaskBoard
          tasks={filteredTasks}
          features={features}
          projectId={projectId}
          projectName={projectName}
          allMembers={allMembers}
          selectedFeatureId={selectedFeatureId}
          onCreateTask={handleCreateTask}
          onUpdateTask={handleUpdateTask}
          onArchiveTask={canArchive ? handleArchiveTask : undefined}
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
        allMembers={allMembers}
        open={!!selectedTask}
        onOpenChange={handleCloseTaskDetail}
        onUpdateTask={handleUpdateTask}
        onArchiveTask={canArchive ? handleArchiveTask : undefined}
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
