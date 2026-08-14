'use client'

import { useState, useEffect, useCallback } from 'react'
import { Timestamp } from 'firebase/firestore'
import { projects, milestones, monthlyPayments, refunds, batch, projectLogs, audit } from '@/lib/firestore'
import { Project, ProjectInput, Milestone, MilestoneInput, MonthlyPayment, MonthlyPaymentInput, ProjectLogChange, Refund, RefundInput } from '@/types'
import { remainingRefundable, expectedPaidFromMilestones } from '@/lib/paymentTotals'
import { useToast } from './useToast'
import { useAuth } from './useAuth'
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
  const { user } = useAuth()

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      const result = await projects.getAll(user?.uid)
      // Show as top-level if: no parent, OR parent not in accessible list
      const accessibleIds = new Set(result.map(p => p.id))
      setData(result.filter(p => !p.parentProjectId || !accessibleIds.has(p.parentProjectId)))
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
  }, [toast, user?.uid])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = async (input: ProjectInput & { ownerId: string }) => {
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

      audit({ type: 'project', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: id, projectName: input.name })

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
      audit({ type: 'project', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: id })
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
      audit({ type: 'project', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId: id })
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
  const [projectRefunds, setRefunds] = useState<Refund[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true)
      const [projectData, milestonesData, paymentsData, subProjectsData, refundsData] = await Promise.all([
        projects.getById(projectId),
        milestones.getAll(projectId),
        monthlyPayments.getAll(projectId),
        projects.getSubProjects(projectId, user?.uid),
        refunds.getAll(projectId),
      ])
      setProject(projectData)
      setMilestones(milestonesData)
      setPayments(paymentsData)
      setSubProjects(subProjectsData)
      setRefunds(refundsData)

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
      const { startDate, deadline, warrantyStartDate, ...nonDateFields } = input
      setProject({
        ...project,
        ...nonDateFields,
        // Handle date fields - convert Date to Timestamp
        ...(startDate !== undefined && { startDate: toTimestamp(startDate)! }),
        ...(deadline !== undefined && { deadline: toTimestamp(deadline) }),
        ...(warrantyStartDate !== undefined && { warrantyStartDate: toTimestamp(warrantyStartDate) }),
      })
    }

    try {
      await projects.update(projectId, input)
      audit({ type: 'project', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name })

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

  // Recompute stored milestoneTotalAmount on the project doc
  const syncMilestoneTotal = async (updatedMilestones: Milestone[]) => {
    const total = updatedMilestones.reduce((sum, m) => sum + m.amount, 0)
    await projects.update(projectId, { milestoneTotalAmount: total }).catch(() => {})
    if (project) setProject({ ...project, milestoneTotalAmount: total })
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
      syncMilestoneTotal([...projectMilestones, newMilestone])
      audit({ type: 'milestone', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: input.name })
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
      if (input.amount !== undefined) {
        const updated = projectMilestones.map(m => m.id === id ? { ...m, amount: input.amount! } : m)
        syncMilestoneTotal(updated)
      }
      const existing = previousMilestones.find(m => m.id === id)
      audit({ type: 'milestone', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: existing?.name })
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
    const existing = previousMilestones.find(m => m.id === id)

    // Optimistically remove the milestone from state
    setMilestones(prev => prev.filter(m => m.id !== id))

    try {
      await milestones.delete(id)
      syncMilestoneTotal(projectMilestones.filter(m => m.id !== id))
      audit({ type: 'milestone', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: existing?.name })
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

  // Refund operations.
  //
  // `paidAmount` is a stored running total that the UI increments when a
  // milestone is marked paid, so a refund decrements it the same way — every
  // screen reading paidAmount then shows money actually kept, unchanged.
  //
  // Write order matters: the refund document goes first, so a failure leaves a
  // visible refund with a stale total (repairable via recalculatePaidAmount)
  // rather than a vanished refund with reduced income, which nothing would show.
  const applyPaidAmountDelta = async (delta: number) => {
    if (!project || delta === 0) return
    const next = Math.max(0, (project.paidAmount || 0) + delta)
    await projects.update(projectId, { paidAmount: next })
    setProject({ ...project, paidAmount: next })
  }

  const createRefund = async (input: Omit<RefundInput, 'projectId'>) => {
    const milestone = projectMilestones.find(m => m.id === input.milestoneId)
    if (!milestone) throw new Error('Milestone not found')

    // The invariant: refunds against a milestone may never exceed its amount.
    const cap = remainingRefundable(milestone, projectRefunds)
    if (input.amount <= 0 || input.amount > cap) {
      toast({
        title: 'Error',
        description: `Refund must be between ${formatCurrency(0.01)} and ${formatCurrency(cap)}`,
        variant: 'destructive',
      })
      throw new Error('Refund exceeds the refundable amount')
    }

    try {
      const id = await refunds.create({ ...input, projectId })
      const newRefund: Refund = {
        id,
        projectId,
        milestoneId: input.milestoneId,
        amount: input.amount,
        reason: input.reason,
        refundedAt: toTimestamp(input.refundedAt)!,
        createdAt: Timestamp.now(),
      }
      setRefunds(prev => [newRefund, ...prev])
      await applyPaidAmountDelta(-input.amount)
      audit({ type: 'payment', action: 'refund_created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: milestone.name, details: { amount: input.amount, milestoneId: input.milestoneId } })
      toast({
        description: 'Refund recorded',
        variant: 'success',
      })
      return id
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to record refund',
        variant: 'destructive',
      })
      throw err
    }
  }

  const updateRefund = async (id: string, input: Partial<Omit<RefundInput, 'projectId' | 'milestoneId'>>) => {
    const previousRefunds = projectRefunds
    const existing = previousRefunds.find(r => r.id === id)
    if (!existing) throw new Error('Refund not found')

    const milestone = projectMilestones.find(m => m.id === existing.milestoneId)
    const newAmount = input.amount !== undefined ? input.amount : existing.amount

    if (milestone && input.amount !== undefined) {
      // Exclude this refund from the cap, otherwise raising 1000 -> 1200 would
      // read as a breach of a cap it already occupies.
      const cap = remainingRefundable(milestone, previousRefunds, id)
      if (newAmount <= 0 || newAmount > cap) {
        toast({
          title: 'Error',
          description: `Refund must be between ${formatCurrency(0.01)} and ${formatCurrency(cap)}`,
          variant: 'destructive',
        })
        throw new Error('Refund exceeds the refundable amount')
      }
    }

    const { refundedAt, ...nonDateFields } = input
    setRefunds(prev => prev.map(r => r.id === id
      ? { ...r, ...nonDateFields, ...(refundedAt !== undefined && { refundedAt: toTimestamp(refundedAt)! }) }
      : r
    ))

    try {
      await refunds.update(id, input)
      // Apply the delta, not the new value — the old amount is already
      // subtracted from paidAmount.
      await applyPaidAmountDelta(existing.amount - newAmount)
      audit({ type: 'payment', action: 'refund_updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: milestone?.name, details: { from: existing.amount, to: newAmount } })
      toast({
        description: 'Refund updated',
        variant: 'success',
      })
    } catch (err) {
      setRefunds(previousRefunds)
      toast({
        title: 'Error',
        description: 'Failed to update refund',
        variant: 'destructive',
      })
      throw err
    }
  }

  const deleteRefund = async (id: string) => {
    const previousRefunds = projectRefunds
    const existing = previousRefunds.find(r => r.id === id)
    if (!existing) return

    setRefunds(prev => prev.filter(r => r.id !== id))

    try {
      await refunds.delete(id)
      // Deleting a refund gives the money back to the project total.
      await applyPaidAmountDelta(existing.amount)
      const milestone = projectMilestones.find(m => m.id === existing.milestoneId)
      audit({ type: 'payment', action: 'refund_deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, targetName: milestone?.name, details: { amount: existing.amount } })
      toast({
        description: 'Refund deleted',
        variant: 'success',
      })
    } catch (err) {
      setRefunds(previousRefunds)
      toast({
        title: 'Error',
        description: 'Failed to delete refund',
        variant: 'destructive',
      })
      throw err
    }
  }

  // Repairs a paidAmount that has drifted from the milestone records — the
  // known weakness of a hand-maintained running total. Milestone projects only.
  const recalculatePaidAmount = async () => {
    if (!project) return
    const expected = expectedPaidFromMilestones(projectMilestones, projectRefunds)
    const current = project.paidAmount || 0
    if (expected === current) {
      toast({ description: 'Paid amount already matches the records' })
      return
    }

    try {
      await projects.update(projectId, { paidAmount: expected })
      setProject({ ...project, paidAmount: expected })
      audit({ type: 'payment', action: 'paid_amount_recalculated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, details: { from: current, to: expected } })
      toast({
        description: `Paid amount corrected from ${formatCurrency(current)} to ${formatCurrency(expected)}`,
        variant: 'success',
      })
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to recalculate paid amount',
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
      setPayments(prev => [newPayment, ...prev])
      audit({ type: 'payment', action: 'created', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id, details: { month: input.month, amount: input.amount, status: input.status } })
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
      audit({ type: 'payment', action: 'updated', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name, targetId: id })
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
      await batch.deleteProjectCascade(projectId, user?.uid)
      audit({ type: 'project', action: 'deleted', actorUid: user?.uid || null, actorEmail: user?.email || '', projectId, projectName: project?.name })
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
    refunds: projectRefunds,
    loading,
    refetch: fetchProject,
    updateProject,
    deleteProject,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createPayment,
    updatePayment,
    createRefund,
    updateRefund,
    deleteRefund,
    recalculatePaidAmount,
  }
}
