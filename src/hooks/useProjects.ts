'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { projects, milestones, monthlyPayments, batch, projectLogs } from '@/lib/firestore'
import { Project, ProjectInput, Milestone, MilestoneInput, MonthlyPayment, MonthlyPaymentInput, ProjectLogChange } from '@/types'
import { useToast } from './useToast'
import { formatCurrency, formatDate, projectFieldLabels } from '@/lib/utils'

// Helper to create a mock Timestamp from Date for optimistic updates
const toTimestamp = (date: Date | null): Timestamp | null => {
  if (!date) return null
  return Timestamp.fromDate(date)
}

// Serialize a project field value to a display string for the activity log
function serializeFieldValue(field: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (field === 'startDate' || field === 'deadline') {
    if (value instanceof Timestamp) return formatDate(value)
    if (value instanceof Date) return formatDate(value)
    return null
  }
  if (field === 'totalAmount' || field === 'paidAmount' || field === 'estimatedValue') {
    return formatCurrency(value as number)
  }
  if (field === 'coverImageUrl') {
    return value ? 'Set' : null
  }
  return String(value)
}

// Compare project fields and return changes
function computeProjectChanges(
  current: Project,
  input: Partial<ProjectInput>
): ProjectLogChange[] {
  const changes: ProjectLogChange[] = []
  const trackedFields = Object.keys(projectFieldLabels)

  for (const field of trackedFields) {
    if (!(field in input)) continue

    const inputValue = (input as unknown as Record<string, unknown>)[field]
    const currentValue = (current as unknown as Record<string, unknown>)[field]

    // Normalize for comparison
    let currentCompare: unknown = currentValue
    let inputCompare: unknown = inputValue

    // Dates: compare as date strings
    if (field === 'startDate' || field === 'deadline') {
      currentCompare = currentValue instanceof Timestamp
        ? currentValue.toDate().toDateString()
        : currentValue instanceof Date
          ? currentValue.toDateString()
          : null
      inputCompare = inputValue instanceof Date
        ? inputValue.toDateString()
        : null
    }

    // Treat empty strings and null/undefined as equivalent
    if ((currentCompare === '' || currentCompare === null || currentCompare === undefined) &&
        (inputCompare === '' || inputCompare === null || inputCompare === undefined)) {
      continue
    }

    // eslint-disable-next-line eqeqeq
    if (currentCompare != inputCompare) {
      changes.push({
        field,
        oldValue: serializeFieldValue(field, currentValue),
        newValue: serializeFieldValue(field, inputValue),
      })
    }
  }

  return changes
}

export function useProjects() {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await projects.getAll()
      setData(result.filter(p => !p.parentProjectId))
      setError(null)
    } catch (err) {
      setError(err as Error)
      toast({
        title: 'Error',
        description: 'Failed to fetch projects',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (input: ProjectInput) => {
    try {
      const id = await projects.create(input)

      // Log project creation
      projectLogs.create({
        projectId: id,
        action: 'created',
        changes: [],
      }).catch(() => {}) // Non-blocking

      // Log activity on parent project if this is a sub-project
      if (input.parentProjectId) {
        projectLogs.create({
          projectId: input.parentProjectId,
          action: 'updated',
          changes: [{
            field: 'subProject',
            oldValue: null,
            newValue: `Added sub-project: ${input.name}`,
          }],
        }).catch(() => {}) // Non-blocking
      }

      await fetchProjects()
      toast({
        description: 'Project created successfully',
        variant: 'success',
      })
      return id
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      })
      throw err
    }
  }

  const updateProject = async (id: string, input: Partial<ProjectInput>) => {
    try {
      await projects.update(id, input)
      await fetchProjects()
      toast({
        description: 'Project updated successfully',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      })
      throw err
    }
  }

  const deleteProject = async (id: string) => {
    try {
      await projects.delete(id)
      await fetchProjects()
      toast({
        description: 'Project deleted successfully',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      })
      throw err
    }
  }

  return {
    projects: data,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  }
}

export function useProject(projectId: string) {
  const [project, setProject] = useState<Project | null>(null)
  const [parentProject, setParentProject] = useState<Project | null>(null)
  const [subProjects, setSubProjects] = useState<Project[]>([])
  const [projectMilestones, setMilestones] = useState<Milestone[]>([])
  const [payments, setPayments] = useState<MonthlyPayment[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const [projectData, milestonesData, paymentsData, subProjectsData] = await Promise.all([
        projects.getById(projectId),
        milestones.getAll(projectId),
        monthlyPayments.getAll(projectId),
        projects.getSubProjects(projectId),
      ])
      setProject(projectData)
      setMilestones(milestonesData)
      setPayments(paymentsData)
      setSubProjects(subProjectsData)

      // Fetch parent if this is a sub-project
      if (projectData?.parentProjectId) {
        const parent = await projects.getById(projectData.parentProjectId)
        setParentProject(parent)
      } else {
        setParentProject(null)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to fetch project details',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [projectId, toast])

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId, fetchProject])

  const updateProject = async (input: Partial<ProjectInput>, showToast = true) => {
    // Store previous state for rollback
    const previousProject = project

    // Compute changes for activity log before optimistic update
    let changes: ProjectLogChange[] = []
    if (project) {
      changes = computeProjectChanges(project, input)
    }

    // Optimistically update the project in state
    if (project) {
      // Extract non-date fields for safe spreading
      const { startDate, deadline, ...nonDateFields } = input
      setProject({
        ...project,
        ...nonDateFields,
        // Handle date fields - convert Date to Timestamp
        ...(startDate !== undefined && { startDate: toTimestamp(startDate)! }),
        ...(deadline !== undefined && { deadline: toTimestamp(deadline) }),
      })
    }

    try {
      await projects.update(projectId, input)

      // Log changes if any fields actually changed
      if (changes.length > 0) {
        const hasStatusChange = changes.some(c => c.field === 'status')
        projectLogs.create({
          projectId,
          action: hasStatusChange ? 'status_changed' : 'updated',
          changes,
        }).catch(() => {}) // Non-blocking
      }

      if (showToast) {
        toast({
          description: 'Project updated',
          variant: 'success',
        })
      }
    } catch (err) {
      // Rollback on error
      setProject(previousProject)
      toast({
        title: 'Error',
        description: 'Failed to update project',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Milestone operations with optimistic updates
  const createMilestone = async (input: Omit<MilestoneInput, 'projectId'>) => {
    try {
      const id = await milestones.create({ ...input, projectId })
      // Optimistically add the new milestone to state
      const newMilestone: Milestone = {
        id,
        projectId,
        name: input.name,
        amount: input.amount,
        dueDate: toTimestamp(input.dueDate)!,
        status: input.status,
        completedAt: toTimestamp(input.completedAt),
        paidAt: toTimestamp(input.paidAt),
      }
      setMilestones(prev => [...prev, newMilestone])
      toast({
        description: 'Milestone created',
        variant: 'success',
      })
      return id
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create milestone',
        variant: 'destructive',
      })
      throw err
    }
  }

  const updateMilestone = async (id: string, input: Partial<MilestoneInput>) => {
    // Store previous state for rollback
    const previousMilestones = projectMilestones

    // Extract non-date fields for safe spreading
    const { dueDate, completedAt, paidAt, ...nonDateFields } = input

    // Optimistically update the milestone in state
    setMilestones(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          ...nonDateFields,
          // Handle date fields - convert Date to Timestamp
          ...(dueDate !== undefined && { dueDate: toTimestamp(dueDate)! }),
          ...(completedAt !== undefined && { completedAt: toTimestamp(completedAt) }),
          ...(paidAt !== undefined && { paidAt: toTimestamp(paidAt) }),
        }
      }
      return m
    }))

    try {
      await milestones.update(id, input)
      toast({
        description: 'Milestone updated',
        variant: 'success',
      })
    } catch (err) {
      // Rollback on error
      setMilestones(previousMilestones)
      toast({
        title: 'Error',
        description: 'Failed to update milestone',
        variant: 'destructive',
      })
      throw err
    }
  }

  const deleteMilestone = async (id: string) => {
    // Store previous state for rollback
    const previousMilestones = projectMilestones

    // Optimistically remove the milestone from state
    setMilestones(prev => prev.filter(m => m.id !== id))

    try {
      await milestones.delete(id)
      toast({
        description: 'Milestone deleted',
        variant: 'success',
      })
    } catch (err) {
      // Rollback on error
      setMilestones(previousMilestones)
      toast({
        title: 'Error',
        description: 'Failed to delete milestone',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Monthly payment operations with optimistic updates
  const createPayment = async (input: Omit<MonthlyPaymentInput, 'projectId'>) => {
    try {
      const id = await monthlyPayments.create({ ...input, projectId })
      // Optimistically add the new payment to state
      const newPayment: MonthlyPayment = {
        id,
        projectId,
        month: input.month,
        amount: input.amount,
        status: input.status,
        paidAt: toTimestamp(input.paidAt),
        notes: input.notes || '',
      }
      setPayments(prev => [...prev, newPayment])
      toast({
        description: 'Payment record created',
        variant: 'success',
      })
      return id
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to create payment record',
        variant: 'destructive',
      })
      throw err
    }
  }

  const updatePayment = async (id: string, input: Partial<MonthlyPaymentInput>) => {
    // Store previous state for rollback
    const previousPayments = payments

    // Extract non-date fields for safe spreading
    const { paidAt, ...nonDateFields } = input

    // Optimistically update the payment in state
    setPayments(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          ...nonDateFields,
          ...(paidAt !== undefined && { paidAt: toTimestamp(paidAt) }),
        }
      }
      return p
    }))

    try {
      await monthlyPayments.update(id, input)
      toast({
        description: 'Payment updated',
        variant: 'success',
      })
    } catch (err) {
      // Rollback on error
      setPayments(previousPayments)
      toast({
        title: 'Error',
        description: 'Failed to update payment',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Delete project with all related data
  const deleteProject = async () => {
    try {
      await batch.deleteProjectCascade(projectId)
      toast({
        description: 'Project and all related data deleted',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete project',
        variant: 'destructive',
      })
      throw err
    }
  }

  return {
    project,
    parentProject,
    subProjects,
    milestones: projectMilestones,
    payments,
    loading,
    refetch: fetchProject,
    updateProject,
    deleteProject,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createPayment,
    updatePayment,
  }
}
