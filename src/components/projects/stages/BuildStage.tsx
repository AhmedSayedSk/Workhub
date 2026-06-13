'use client'

import { ProjectTasksTab } from '@/components/projects/ProjectTasksTab'
import type { Project } from '@/types'

interface Props {
  project: Project
  canMoveTasks: boolean
  canArchive?: boolean
  ownerEmail?: string
  ownerName?: string
}

export function BuildStage({ project, canMoveTasks, canArchive = true, ownerEmail, ownerName }: Props) {
  return (
    <div className="flex min-h-0 flex-col lg:flex-1">
      <ProjectTasksTab
        projectId={project.id}
        projectName={project.name}
        projectOwnerId={project.ownerId}
        projectOwnerEmail={ownerEmail}
        projectOwnerName={ownerName}
        canArchive={canArchive}
        canMoveTasks={canMoveTasks}
      />
    </div>
  )
}
