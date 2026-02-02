'use client'

import { useState, useEffect, useCallback } from 'react'
import { projects, milestones, monthlyPayments, batch } from '@/lib/firestore'
import { Project, ProjectInput, Milestone, MilestoneInput, MonthlyPayment, MonthlyPaymentInput } from '@/types'
import { useToast } from './useToast'

export function useProjects(systemId?: string) {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await projects.getAll(systemId)
      setData(result)
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
  }, [systemId, toast])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (input: ProjectInput) => {
    try {
      const id = await projects.create(input)
      await fetchProjects()
      toast({
        title: 'Success',
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
        title: 'Success',
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
        title: 'Success',
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
  const [projectMilestones, setMilestones] = useState<Milestone[]>([])
  const [payments, setPayments] = useState<MonthlyPayment[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const [projectData, milestonesData, paymentsData] = await Promise.all([
        projects.getById(projectId),
        milestones.getAll(projectId),
        monthlyPayments.getAll(projectId),
      ])
      setProject(projectData)
      setMilestones(milestonesData)
      setPayments(paymentsData)
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

  const updateProject = async (input: Partial<ProjectInput>) => {
    try {
      await projects.update(projectId, input)
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Project updated',
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

  // Milestone operations
  const createMilestone = async (input: Omit<MilestoneInput, 'projectId'>) => {
    try {
      await milestones.create({ ...input, projectId })
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Milestone created',
        variant: 'success',
      })
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
    try {
      await milestones.update(id, input)
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Milestone updated',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to update milestone',
        variant: 'destructive',
      })
      throw err
    }
  }

  const deleteMilestone = async (id: string) => {
    try {
      await milestones.delete(id)
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Milestone deleted',
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to delete milestone',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Monthly payment operations
  const createPayment = async (input: Omit<MonthlyPaymentInput, 'projectId'>) => {
    try {
      await monthlyPayments.create({ ...input, projectId })
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Payment record created',
        variant: 'success',
      })
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
    try {
      await monthlyPayments.update(id, input)
      await fetchProject()
      toast({
        title: 'Success',
        description: 'Payment updated',
        variant: 'success',
      })
    } catch (err) {
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
        title: 'Success',
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
