'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useProjects } from '@/hooks/useProjects'
import { useSystems } from '@/hooks/useSystems'
import { projects as projectsApi, tasks as tasksApi } from '@/lib/firestore'
import { System, PaymentModel, ProjectStatus, Project } from '@/types'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
  formatRemainingTime,
  formatTimeSince,
  projectTypes,
} from '@/lib/utils'
import {
  Plus,
  FolderKanban,
  Building2,
  Calendar,
  DollarSign,
  Milestone,
  Clock,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
  ListTodo,
} from 'lucide-react'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const paymentModelLabels: Record<PaymentModel, string> = {
  milestone: 'Milestones',
  monthly: 'Monthly',
  fixed: 'Fixed Price',
  internal: 'Internal',
}

const paymentModelIcons: Record<PaymentModel, typeof Milestone> = {
  milestone: Milestone,
  monthly: Calendar,
  fixed: DollarSign,
  internal: Building2,
}

const statusConfig: Record<ProjectStatus, {
  label: string
  icon: typeof PlayCircle
}> = {
  active: {
    label: 'Active',
    icon: PlayCircle,
  },
  paused: {
    label: 'Paused',
    icon: PauseCircle,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
  },
}

const statusOrder: ProjectStatus[] = ['active', 'paused', 'completed', 'cancelled']


export default function ProjectsPage() {
  const router = useRouter()
  const { projects, loading } = useProjects()
  const { systems } = useSystems()
  const [subProjectsByParent, setSubProjectsByParent] = useState<Record<string, Project[]>>({})
  const [subTaskCounts, setSubTaskCounts] = useState<Record<string, number>>({})

  // Fetch all projects (including sub-projects) and their active task counts
  useEffect(() => {
    projectsApi.getAll().then(async (allProjects) => {
      const map: Record<string, Project[]> = {}
      const subIds: string[] = []
      allProjects.forEach((p) => {
        if (p.parentProjectId) {
          if (!map[p.parentProjectId]) map[p.parentProjectId] = []
          map[p.parentProjectId].push(p)
          subIds.push(p.id)
        }
      })
      setSubProjectsByParent(map)

      // Fetch task counts for sub-projects
      if (subIds.length > 0) {
        const allTasks = await Promise.all(
          subIds.map((id) => tasksApi.getAll(undefined, id))
        )
        const counts: Record<string, number> = {}
        subIds.forEach((id, i) => {
          counts[id] = allTasks[i].filter(
            (t) => ['todo', 'in_progress', 'review'].includes(t.status) && !t.archived && !t.waiting
          ).length
        })
        setSubTaskCounts(counts)
      }
    })
  }, [projects]) // re-compute when top-level projects change

  const systemsMap = systems.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {} as Record<string, System>)

  // Group projects by status and sort by start date (oldest first)
  const groupedProjects = useMemo(() => {
    const groups: Record<ProjectStatus, Project[]> = {
      active: [],
      paused: [],
      completed: [],
      cancelled: [],
    }

    projects.forEach((project) => {
      groups[project.status].push(project)
    })

    // Sort each group by start date (oldest first)
    Object.keys(groups).forEach((status) => {
      groups[status as ProjectStatus].sort((a, b) => {
        const dateA = a.startDate?.toDate()?.getTime() ?? 0
        const dateB = b.startDate?.toDate()?.getTime() ?? 0
        return dateA - dateB
      })
    })

    return groups
  }, [projects])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage and track all your projects
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first project to get started
            </p>
            <Link href="/projects/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {statusOrder.map((status) => {
            const projectsInGroup = groupedProjects[status]
            if (projectsInGroup.length === 0) return null

            const config = statusConfig[status]
            const StatusIcon = config.icon

            return (
              <div key={status} className="space-y-4">
                {/* Group Header */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted flex-shrink-0">
                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-medium">
                      {config.label}
                    </h2>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {projectsInGroup.length}
                    </Badge>
                  </div>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Projects Grid */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {projectsInGroup.map((project) => {
                    const system = systemsMap[project.systemId]
                    const progress = calculateProgress(project.paidAmount, project.totalAmount)
                    const PaymentIcon = paymentModelIcons[project.paymentModel]

                    return (
                      <div key={project.id} onClick={() => router.push(`/projects/${project.id}`)}>
                        <Card
                          className="h-full hover:shadow-md transition-all cursor-pointer overflow-hidden border"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${project.color || system?.color || '#6B8DD6'} 6%, transparent)`,
                          }}
                        >
                          <CardHeader className="pb-1 pt-4 px-4 relative">
                            <div className="absolute top-3 right-3 flex items-center gap-1 text-muted-foreground">
                              <PaymentIcon className="h-4 w-4" />
                              <span className="text-xs">
                                {paymentModelLabels[project.paymentModel]}
                              </span>
                            </div>
                            <div className="flex items-start gap-3">
                              <ProjectIcon
                                src={project.coverImageUrl}
                                name={project.name}
                                size="lg"
                              />
                              <div className="flex-1 min-w-0">
                                <CardTitle className="text-xl pr-16 !mt-0 truncate">{project.name}</CardTitle>
                                {project.paymentModel === 'internal' ? (
                                  <p className="text-sm text-muted-foreground">
                                    Internal Project
                                    {project.projectType && project.projectType !== 'other' && (
                                      <span className="text-muted-foreground/70"> · {projectTypes.find((t) => t.value === project.projectType)?.label}</span>
                                    )}
                                  </p>
                                ) : (
                                  <p className="text-sm">
                                    {project.clientName && (
                                      <span className="text-primary font-medium">{project.clientName}</span>
                                    )}
                                    {project.projectType && project.projectType !== 'other' && (
                                      <span className="text-muted-foreground"> · {projectTypes.find((t) => t.value === project.projectType)?.label}</span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            {project.description && (
                              <CardDescription className="line-clamp-2 pt-1.5">
                                {project.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent className="p-4 pt-3">
                            <div className="space-y-4">
                              {/* Financial Progress - Only for milestone/fixed projects */}
                              {project.paymentModel !== 'monthly' && project.paymentModel !== 'internal' && (
                                <div className="space-y-2">
                                  <Progress value={progress} className="h-2" />
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {formatCurrency(project.paidAmount)}
                                    </span>
                                    <span className="font-medium">
                                      {formatCurrency(project.totalAmount)}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Internal project estimated value */}
                              {project.paymentModel === 'internal' && project.estimatedValue && project.estimatedValue > 0 && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>Estimated Value: {formatCurrency(project.estimatedValue)}</span>
                                </div>
                              )}

                              {/* Separator - before sub-projects for normal, after for parents */}
                              {!subProjectsByParent[project.id]?.length && (
                                <hr className="border-border" />
                              )}

                              {/* Sub-Projects */}
                              {subProjectsByParent[project.id]?.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-projects</p>
                                  <div className="flex items-center gap-4 flex-wrap">
                                    <TooltipProvider delayDuration={200}>
                                      {subProjectsByParent[project.id].map((sub) => {
                                        const SubStatusIcon = statusConfig[sub.status].icon
                                        const subStatusLabel = statusConfig[sub.status].label
                                        const taskCount = subTaskCounts[sub.id] || 0

                                        return (
                                          <Tooltip key={sub.id}>
                                            <TooltipTrigger asChild>
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  router.push(`/projects/${sub.id}`)
                                                }}
                                                onPointerDown={(e) => e.stopPropagation()}
                                                className="cursor-pointer hover:opacity-80 transition-all"
                                              >
                                                <ProjectIcon src={sub.coverImageUrl} name={sub.name} size="md-lg" />
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="p-0 w-[240px]">
                                              <div className="p-3 space-y-2.5">
                                                {/* Header */}
                                                <div className="flex items-center gap-2">
                                                  <ProjectIcon src={sub.coverImageUrl} name={sub.name} size="sm" />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm">{sub.name}</p>
                                                  </div>
                                                </div>

                                                {/* Description */}
                                                {sub.description && (
                                                  <p className="text-xs text-muted-foreground line-clamp-2">{sub.description}</p>
                                                )}

                                                {/* Info rows */}
                                                <div className="space-y-1.5 text-xs">
                                                  {/* Status */}
                                                  <div className="flex items-center gap-2 text-muted-foreground">
                                                    <SubStatusIcon className="h-3.5 w-3.5 shrink-0" />
                                                    <span>{subStatusLabel}</span>
                                                  </div>

                                                  {/* Tasks */}
                                                  {taskCount > 0 && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                      <ListTodo className="h-3.5 w-3.5 shrink-0" />
                                                      <span>{taskCount} active task{taskCount !== 1 ? 's' : ''}</span>
                                                    </div>
                                                  )}

                                                  {/* Start date */}
                                                  {sub.startDate && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                      <span>Started {formatDate(sub.startDate)}</span>
                                                    </div>
                                                  )}

                                                  {/* Deadline */}
                                                  {sub.deadline && (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                      <Clock className="h-3.5 w-3.5 shrink-0" />
                                                      <span>Due {formatDate(sub.deadline)}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </TooltipContent>
                                          </Tooltip>
                                        )
                                      })}
                                    </TooltipProvider>
                                  </div>
                                </div>
                              )}

                              {subProjectsByParent[project.id]?.length > 0 && (
                                <hr className="border-border" />
                              )}

                              {/* Dates */}
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-sky-600/70 dark:text-sky-400/80" />
                                    <span>Started {formatDate(project.startDate)}</span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeSince(project.startDate)}
                                  </span>
                                </div>
                                {project.deadline && (
                                  <div className="text-right">
                                    <div className="flex items-center gap-1 justify-end">
                                      <Clock className="h-4 w-4 text-amber-600/70 dark:text-amber-400/80" />
                                      <span>Due {formatDate(project.deadline)}</span>
                                    </div>
                                    {project.status === 'active' && (() => {
                                      const remaining = formatRemainingTime(project.deadline)
                                      return (
                                        <span className={`text-xs ${remaining.isOverdue ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'}`}>
                                          {remaining.text}
                                        </span>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
