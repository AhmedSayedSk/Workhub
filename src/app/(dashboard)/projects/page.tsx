'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useProjects } from '@/hooks/useProjects'
import { useSystems } from '@/hooks/useSystems'
import { System, PaymentModel, ProjectStatus, Project } from '@/types'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
  formatRemainingTime,
} from '@/lib/utils'
import {
  Plus,
  FolderKanban,
  Calendar,
  DollarSign,
  Milestone,
  Clock,
  PlayCircle,
  CheckCircle2,
  PauseCircle,
  XCircle,
} from 'lucide-react'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'

const paymentModelLabels: Record<PaymentModel, string> = {
  milestone: 'Milestones',
  monthly: 'Monthly',
  fixed: 'Fixed Price',
}

const paymentModelIcons: Record<PaymentModel, typeof Milestone> = {
  milestone: Milestone,
  monthly: Calendar,
  fixed: DollarSign,
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
  const { projects, loading } = useProjects()
  const { systems } = useSystems()

  const systemsMap = systems.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {} as Record<string, System>)

  // Group projects by status
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
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {projectsInGroup.map((project) => {
                    const system = systemsMap[project.systemId]
                    const progress = calculateProgress(project.paidAmount, project.totalAmount)
                    const PaymentIcon = paymentModelIcons[project.paymentModel]

                    return (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <Card className="h-full hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                          <CardHeader className="pb-3 relative">
                            <div className="absolute top-4 right-4 flex items-center gap-1 text-muted-foreground">
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
                                {system && (
                                  <div
                                    className="w-2 h-2 rounded-full mb-1"
                                    style={{ backgroundColor: system.color }}
                                  />
                                )}
                                <CardTitle className="text-xl pr-16 !mt-0 truncate">{project.name}</CardTitle>
                                {project.clientName && (
                                  <p className="text-sm text-primary font-medium">
                                    {project.clientName}
                                  </p>
                                )}
                              </div>
                            </div>
                            {project.description && (
                              <CardDescription className="line-clamp-2 mt-2">
                                {project.description}
                              </CardDescription>
                            )}
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {/* Financial Progress */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Payment Progress</span>
                                  <span className="font-medium">{progress}%</span>
                                </div>
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

                              {/* Separator */}
                              <hr className="border-border" />

                              {/* Dates */}
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4 text-sky-600/70 dark:text-sky-400/80" />
                                  <span>Started {formatDate(project.startDate)}</span>
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
                      </Link>
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
