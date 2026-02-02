'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/useProjects'
import { useSystems } from '@/hooks/useSystems'
import { System, ProjectStatus, PaymentModel } from '@/types'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
} from '@/lib/utils'
import {
  Plus,
  FolderKanban,
  Search,
  Calendar,
  DollarSign,
  Milestone,
  Clock,
} from 'lucide-react'

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

export default function ProjectsPage() {
  const searchParams = useSearchParams()
  const systemFilter = searchParams.get('system')

  const { projects, loading } = useProjects(systemFilter || undefined)
  const { systems } = useSystems()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedSystem, setSelectedSystem] = useState<string>(systemFilter || 'all')

  const systemsMap = systems.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {} as Record<string, System>)

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.description.toLowerCase().includes(search.toLowerCase()) ||
      (project.clientName && project.clientName.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter
    const matchesSystem = selectedSystem === 'all' ||
      (selectedSystem === 'none' ? !project.systemId : project.systemId === selectedSystem)

    return matchesSearch && matchesStatus && matchesSystem
  })

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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={selectedSystem} onValueChange={setSelectedSystem}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="All Systems" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Systems</SelectItem>
                <SelectItem value="none">
                  <span className="text-muted-foreground">No System</span>
                </SelectItem>
                {systems.map((system) => (
                  <SelectItem key={system.id} value={system.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: system.color }}
                      />
                      {system.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderKanban className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {projects.length === 0
                ? 'Create your first project to get started'
                : 'No projects match your current filters'}
            </p>
            {projects.length === 0 && (
              <Link href="/projects/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const system = systemsMap[project.systemId]
            const progress = calculateProgress(project.paidAmount, project.totalAmount)
            const PaymentIcon = paymentModelIcons[project.paymentModel]

            return (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {system && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: system.color }}
                          />
                        )}
                        <Badge
                          variant="outline"
                          className={statusColors.project[project.status]}
                        >
                          {project.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <PaymentIcon className="h-4 w-4" />
                        <span className="text-xs">
                          {paymentModelLabels[project.paymentModel]}
                        </span>
                      </div>
                    </div>
                    <CardTitle className="text-lg mt-2">{project.name}</CardTitle>
                    {project.clientName && (
                      <p className="text-sm text-primary font-medium">
                        {project.clientName}
                      </p>
                    )}
                    {project.description && (
                      <CardDescription className="line-clamp-2">
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

                      {/* Dates */}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-sky-600/70 dark:text-sky-400/80" />
                          <span>Started {formatDate(project.startDate)}</span>
                        </div>
                        {project.deadline && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-amber-600/70 dark:text-amber-400/80" />
                            <span>Due {formatDate(project.deadline)}</span>
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
      )}
    </div>
  )
}
