'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { projects, tasks } from '@/lib/firestore'
import { Project, Task } from '@/types'
import { Loader2, FolderKanban, ListTodo } from 'lucide-react'

interface FileLinkSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentProjectLinks: string[]
  currentTaskLinks: string[]
  onLink: (projectIds: string[], taskIds: string[]) => Promise<void>
}

export function FileLinkSelector({
  open,
  onOpenChange,
  currentProjectLinks,
  currentTaskLinks,
  onLink,
}: FileLinkSelectorProps) {
  const [projectList, setProjectList] = useState<Project[]>([])
  const [taskList, setTaskList] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedProjects(new Set(currentProjectLinks))
      setSelectedTasks(new Set(currentTaskLinks))
      loadData()
    }
  }, [open, currentProjectLinks, currentTaskLinks])

  const loadData = async () => {
    setLoading(true)
    try {
      const [projectsData, tasksData] = await Promise.all([
        projects.getAll(),
        tasks.getAll(),
      ])
      setProjectList(projectsData)
      setTaskList(tasksData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onLink(Array.from(selectedProjects), Array.from(selectedTasks))
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to Project or Task</DialogTitle>
          <DialogDescription>
            Select projects and tasks to link this file to
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="projects" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="projects" className="gap-2">
                <FolderKanban className="h-4 w-4" />
                Projects ({selectedProjects.size})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ListTodo className="h-4 w-4" />
                Tasks ({selectedTasks.size})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              <ScrollArea className="h-64">
                {projectList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No projects available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectList.map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => toggleProject(project.id)}
                      >
                        <Checkbox
                          checked={selectedProjects.has(project.id)}
                          onCheckedChange={() => toggleProject(project.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{project.name}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {project.clientName || 'No client'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <ScrollArea className="h-64">
                {taskList.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No tasks available
                  </div>
                ) : (
                  <div className="space-y-2">
                    {taskList.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                        onClick={() => toggleTask(task.id)}
                      >
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => toggleTask(task.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{task.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {task.status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Links
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
