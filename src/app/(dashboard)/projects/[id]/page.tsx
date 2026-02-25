'use client'

import { use, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContentBoxed, TabsListBoxed, TabsTriggerBoxed } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { MonthPicker } from '@/components/ui/month-picker'
import { PhoneInput } from '@/components/ui/phone-input'
import { Textarea } from '@/components/ui/textarea'
import { useProject } from '@/hooks/useProjects'
import { useProjectLogs } from '@/hooks/useProjectLogs'
import { useAuth } from '@/hooks/useAuth'
import { MilestoneStatus, PaymentModel, MonthlyPayment, ProjectInput, ProjectStatus, ProjectType, Milestone as MilestoneType } from '@/types'
import { format } from 'date-fns'
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatDateTime,
  statusColors,
  calculateProgress,
  cn,
  colorPresets,
  projectFieldLabels,
  projectTypes,
} from '@/lib/utils'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Edit,
  FolderKanban,
  History,
  Link2,
  Loader2,
  Milestone,
  Plus,
  Trash2,
  Wallet,
  ListTodo,
  Paperclip,
  KeyRound,
  Check,
  ChevronsUpDown,
} from 'lucide-react'
import { ProjectTasksTab } from '@/components/projects/ProjectTasksTab'
import { ProjectAttachmentsTab } from '@/components/projects/ProjectAttachmentsTab'
import { ProjectVaultTab } from '@/components/projects/ProjectVaultTab'
import { ProjectImagePicker, ProjectIcon } from '@/components/projects/ProjectImagePicker'

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const {
    project,
    parentProject,
    subProjects,
    milestones,
    payments,
    loading,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createPayment,
    updatePayment,
    updateProject,
    deleteProject,
  } = useProject(id)
  const { logs: activityLogs, loading: logsLoading, refetch: refetchLogs, deleteLog } = useProjectLogs(id)
  const { reauthenticate } = useAuth()

  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePasswordError, setDeletePasswordError] = useState('')
  const [deleteAttempts, setDeleteAttempts] = useState(0)
  const [deleteCooldown, setDeleteCooldown] = useState(0)
  const cooldownRef = useRef<NodeJS.Timeout | null>(null)
  const maxDeleteAttempts = 3
  const cooldownSeconds = 15 * 60 // 15 minutes
  const cooldownKey = `delete-cooldown-${id}`

  const startCooldownTimer = useCallback((remaining: number) => {
    setDeleteCooldown(remaining)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setDeleteCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          cooldownRef.current = null
          localStorage.removeItem(cooldownKey)
          setDeleteAttempts(0)
          setDeletePassword('')
          setDeletePasswordError('')
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [cooldownKey])

  const startCooldown = useCallback(() => {
    const expiresAt = Date.now() + cooldownSeconds * 1000
    localStorage.setItem(cooldownKey, expiresAt.toString())
    startCooldownTimer(cooldownSeconds)
  }, [cooldownKey, startCooldownTimer])

  // Restore cooldown from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(cooldownKey)
    if (stored) {
      const remaining = Math.ceil((parseInt(stored) - Date.now()) / 1000)
      if (remaining > 0) {
        setDeleteAttempts(maxDeleteAttempts)
        setDeletePasswordError(`Too many failed attempts. Try again in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}.`)
        startCooldownTimer(remaining)
      } else {
        localStorage.removeItem(cooldownKey)
      }
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [cooldownKey, startCooldownTimer])

  const [milestoneForm, setMilestoneForm] = useState({
    name: '',
    amount: '',
    dueDate: new Date() as Date | null,
  })

  const [editForm, setEditForm] = useState({
    name: '',
    clientName: '',
    clientNumber: '',
    description: '',
    status: 'active' as ProjectStatus,
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    estimatedValue: '',
    startDate: null as Date | null,
    deadline: null as Date | null,
    notes: '',
    coverImageUrl: null as string | null,
    color: colorPresets[0].value,
    projectType: null as ProjectType | null,
  })

  const [paymentForm, setPaymentForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: '',
    notes: '',
  })
  const [editingPayment, setEditingPayment] = useState<MonthlyPayment | null>(null)
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<MilestoneType | null>(null)
  const [isEditMilestoneDialogOpen, setIsEditMilestoneDialogOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-2">Project not found</h2>
        <p className="text-muted-foreground mb-4">
          The project you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link href="/projects">
          <Button>Back to Projects</Button>
        </Link>
      </div>
    )
  }

  // For monthly projects, "owed" doesn't make sense the same way
  // Monthly projects: totalAmount is monthly rate, paidAmount is total received
  // Internal projects have no payment tracking
  const isMonthly = project.paymentModel === 'monthly'
  const isInternal = project.paymentModel === 'internal'
  const progress = (isMonthly || isInternal) ? 0 : calculateProgress(project.paidAmount, project.totalAmount)

  // For non-monthly: owed = total - paid
  // For monthly: owed = sum of pending monthly payments
  // For internal: no owed amount
  const pendingPaymentsTotal = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0)
  const owedAmount = isInternal ? 0 : (isMonthly ? pendingPaymentsTotal : Math.max(0, project.totalAmount - project.paidAmount))

  const handleCreateMilestone = async () => {
    if (!milestoneForm.name || !milestoneForm.amount || !milestoneForm.dueDate) return

    setIsSubmitting(true)
    try {
      await createMilestone({
        name: milestoneForm.name,
        amount: parseFloat(milestoneForm.amount),
        dueDate: milestoneForm.dueDate,
        status: 'pending',
        completedAt: null,
        paidAt: null,
      })
      setMilestoneForm({
        name: '',
        amount: '',
        dueDate: new Date(),
      })
      setIsMilestoneDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMilestoneStatusChange = async (
    milestoneId: string,
    status: MilestoneStatus
  ) => {
    const updates: { status: MilestoneStatus; completedAt?: Date | null; paidAt?: Date | null } = {
      status,
    }

    if (status === 'completed') {
      updates.completedAt = new Date()
    } else if (status === 'paid') {
      updates.completedAt = updates.completedAt || new Date()
      updates.paidAt = new Date()

      // Update project paid amount (suppress toast, milestone update will show one)
      const milestone = milestones.find((m) => m.id === milestoneId)
      if (milestone) {
        await updateProject({
          paidAmount: project.paidAmount + milestone.amount,
        }, false)
        refetchLogs()
      }
    }

    await updateMilestone(milestoneId, updates)
  }

  const handleOpenEditMilestone = (milestone: MilestoneType) => {
    setEditingMilestone(milestone)
    setMilestoneForm({
      name: milestone.name,
      amount: milestone.amount.toString(),
      dueDate: milestone.dueDate.toDate(),
    })
    setIsEditMilestoneDialogOpen(true)
  }

  const handleEditMilestone = async () => {
    if (!editingMilestone || !milestoneForm.name || !milestoneForm.amount || !milestoneForm.dueDate) return

    setIsSubmitting(true)
    try {
      await updateMilestone(editingMilestone.id, {
        name: milestoneForm.name,
        amount: parseFloat(milestoneForm.amount),
        dueDate: milestoneForm.dueDate,
      })
      setMilestoneForm({ name: '', amount: '', dueDate: new Date() })
      setEditingMilestone(null)
      setIsEditMilestoneDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreatePayment = async () => {
    if (!paymentForm.month || !paymentForm.amount) return

    setIsSubmitting(true)
    try {
      await createPayment({
        month: paymentForm.month,
        amount: parseFloat(paymentForm.amount),
        status: 'pending',
        paidAt: null,
        notes: paymentForm.notes,
      })
      setPaymentForm({
        month: new Date().toISOString().slice(0, 7),
        amount: project.totalAmount.toString(),
        notes: '',
      })
      setIsPaymentDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenEditPayment = (payment: MonthlyPayment) => {
    setEditingPayment(payment)
    setPaymentForm({
      month: payment.month,
      amount: payment.amount.toString(),
      notes: payment.notes || '',
    })
    setIsEditPaymentDialogOpen(true)
  }

  const handleEditPayment = async () => {
    if (!editingPayment || !paymentForm.month || !paymentForm.amount) return

    setIsSubmitting(true)
    try {
      const oldAmount = editingPayment.amount
      const newAmount = parseFloat(paymentForm.amount)

      await updatePayment(editingPayment.id, {
        month: paymentForm.month,
        amount: newAmount,
        notes: paymentForm.notes,
      })

      // Update project paid amount if payment was already paid and amount changed
      if (editingPayment.status === 'paid' && oldAmount !== newAmount) {
        const amountDifference = newAmount - oldAmount
        await updateProject({
          paidAmount: project.paidAmount + amountDifference,
        }, false)
      }

      setPaymentForm({
        month: new Date().toISOString().slice(0, 7),
        amount: project.totalAmount.toString(),
        notes: '',
      })
      setEditingPayment(null)
      setIsEditPaymentDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMarkPaymentPaid = async (paymentId: string, amount: number) => {
    await updatePayment(paymentId, {
      status: 'paid',
      paidAt: new Date(),
    })
    await updateProject({
      paidAmount: project.paidAmount + amount,
    })
    refetchLogs()
  }

  const handleDeleteProject = async () => {
    setDeletePasswordError('')
    setIsDeleting(true)
    try {
      await reauthenticate(deletePassword)
      await deleteProject()
      router.push(parentProject ? `/projects/${parentProject.id}` : '/projects')
    } catch (err: unknown) {
      const error = err as { code?: string | number; message?: string }
      const isAuthError = String(error.code ?? '').startsWith('auth/') ||
        error.code === 400 ||
        error.message?.includes('INVALID_LOGIN_CREDENTIALS')
      if (isAuthError) {
        const newAttempts = deleteAttempts + 1
        setDeleteAttempts(newAttempts)
        if (newAttempts >= maxDeleteAttempts) {
          setDeletePasswordError(`Too many failed attempts.`)
          startCooldown()
        } else {
          setDeletePasswordError(`Incorrect password (${maxDeleteAttempts - newAttempts} attempt${maxDeleteAttempts - newAttempts === 1 ? '' : 's'} remaining)`)
        }
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const openEditDialog = () => {
    if (project) {
      setEditForm({
        name: project.name,
        clientName: project.clientName || '',
        clientNumber: project.clientNumber || '',
        description: project.description,
        status: project.status,
        paymentModel: project.paymentModel,
        totalAmount: project.totalAmount.toString(),
        estimatedValue: project.estimatedValue?.toString() || '',
        startDate: project.startDate.toDate(),
        deadline: project.deadline ? project.deadline.toDate() : null,
        notes: project.notes,
        coverImageUrl: project.coverImageUrl || null,
        color: project.color || colorPresets[0].value,
        projectType: project.projectType || null,
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleEditProject = async () => {
    if (!editForm.name.trim() || !editForm.startDate) return

    setIsSubmitting(true)
    try {
      const isEditInternal = editForm.paymentModel === 'internal'
      const updateData: Partial<ProjectInput> = {
        name: editForm.name,
        clientName: editForm.clientName,
        clientNumber: editForm.clientNumber,
        description: editForm.description,
        status: editForm.status,
        paymentModel: editForm.paymentModel,
        totalAmount: isEditInternal ? 0 : (parseFloat(editForm.totalAmount) || 0),
        startDate: editForm.startDate,
        deadline: editForm.deadline,
        notes: editForm.notes,
        coverImageUrl: editForm.coverImageUrl,
        color: editForm.color,
        projectType: editForm.projectType || null,
      }
      if (isEditInternal && editForm.estimatedValue) {
        updateData.estimatedValue = parseFloat(editForm.estimatedValue)
      }
      await updateProject(updateData)
      await refetchLogs()
      setIsEditDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Link href={parentProject ? `/projects/${parentProject.id}` : '/projects'} className="shrink-0">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <ProjectIcon
            src={project.coverImageUrl}
            name={project.name}
            size="lg"
          />
          <div className="min-w-0">
            {/* Breadcrumb for sub-projects */}
            {parentProject && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-0.5">
                <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <Link href={`/projects/${parentProject.id}`} className="hover:text-foreground transition-colors">{parentProject.name}</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-foreground">{project.name}</span>
              </div>
            )}
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              {!isInternal && project.clientName && (
                <span className="text-sm font-medium text-primary">· {project.clientName}</span>
              )}
              {project.projectType && project.projectType !== 'other' && (
                <span className="text-sm text-muted-foreground">· {projectTypes.find((t) => t.value === project.projectType)?.label}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-muted-foreground truncate">{project.description}</p>
              {parentProject && !project.hasOwnFinances && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 shrink-0">
                  <Link2 className="h-3 w-3 mr-1" />
                  Shared finances
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={statusColors.project[project.status]}
          >
            {project.status}
          </Badge>
          {isInternal && (
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-0">
              <Building2 className="h-3 w-3 mr-1" />
              Internal
            </Badge>
          )}
          {!project.parentProjectId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <FolderKanban className="h-4 w-4" />
                Sub-Projects
                {subProjects.length > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    {subProjects.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Sub-Projects</DialogTitle>
                <DialogDescription>
                  Manage sub-projects under {project.name}
                </DialogDescription>
              </DialogHeader>
              {subProjects.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="mb-1">No sub-projects yet</p>
                  <p className="text-sm mb-4">Create sub-projects to break this project into smaller parts</p>
                  <Link href={`/projects/new?parent=${id}`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Sub-Project
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <Link href={`/projects/new?parent=${id}`}>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Sub-Project
                      </Button>
                    </Link>
                  </div>
                  <div className="grid gap-3">
                    {subProjects.map((sub) => {
                      const subIsInternal = sub.paymentModel === 'internal'
                      return (
                        <Link key={sub.id} href={`/projects/${sub.id}`}>
                          <div
                            className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-sm transition-all cursor-pointer"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${sub.color || project.color || '#6B8DD6'} 6%, transparent)`,
                            }}
                          >
                            <ProjectIcon src={sub.coverImageUrl} name={sub.name} size="md" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{sub.name}</p>
                                <Badge variant="outline" className={statusColors.project[sub.status]}>
                                  {sub.status}
                                </Badge>
                                {!sub.hasOwnFinances && (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 text-xs">
                                    <Link2 className="h-3 w-3 mr-0.5" />
                                    Shared
                                  </Badge>
                                )}
                              </div>
                              {sub.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{sub.description}</p>
                              )}
                            </div>
                            {sub.hasOwnFinances !== false && !subIsInternal && (
                              <div className="text-right text-sm shrink-0">
                                <p className="font-medium">{formatCurrency(sub.totalAmount)}</p>
                                <p className="text-muted-foreground">{formatCurrency(sub.paidAmount)} paid</p>
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          )}

          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Edit className="h-4 w-4 mr-1.5" />
            Edit
          </Button>

          <AlertDialog onOpenChange={(open) => { if (!open) { setDeleteConfirmation(''); setDeletePassword(''); if (!deleteCooldown) { setDeletePasswordError(''); setDeleteAttempts(0) } } }}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-muted-foreground">
                    <p>
                      Are you sure you want to delete <span className="font-semibold">{project.name}</span>?
                      This will permanently remove the project and all related data including:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All milestones and payments</li>
                      <li>All features, tasks, and subtasks</li>
                      <li>All time entries</li>
                    </ul>
                    <p className="mt-2 text-destructive font-medium">This action cannot be undone.</p>
                    <div className="mt-4 space-y-2">
                      <p>Type <span className="font-semibold text-foreground">{project.name}</span> to confirm:</p>
                      <Input
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder={project.name}
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div className="mt-3 space-y-2">
                      <p>Enter your password:</p>
                      <Input
                        type="password"
                        value={deletePassword}
                        onChange={(e) => { setDeletePassword(e.target.value); if (!deleteCooldown) setDeletePasswordError('') }}
                        placeholder="Password"
                        className="mt-1"
                        autoComplete="current-password"
                      />
                      {deletePasswordError && (
                        <p className="text-xs text-destructive">
                          {deleteCooldown > 0
                            ? `Too many failed attempts. Try again in ${Math.floor(deleteCooldown / 60)}:${String(deleteCooldown % 60).padStart(2, '0')}.`
                            : deletePasswordError}
                        </p>
                      )}
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={handleDeleteProject}
                  disabled={isDeleting || deleteConfirmation !== project.name || !deletePassword || deleteCooldown > 0}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Delete Project'
                  )}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Overview - Only for non-internal projects with own finances */}
      {!isInternal && project.hasOwnFinances !== false && (
        <div className="grid gap-4 md:grid-cols-3 shrink-0">
          <Card className="py-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-1">
              <CardTitle className="text-sm font-medium">
                {isMonthly ? 'Monthly Rate' : 'Total Value'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-1">
              <div className="text-2xl font-bold">
                {formatCurrency(project.totalAmount)}
              </div>
              {isMonthly && (
                <p className="text-xs text-muted-foreground">per month</p>
              )}
            </CardContent>
          </Card>

          <Card className="py-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-1">
              <CardTitle className="text-sm font-medium">
                {isMonthly ? 'Total Received' : 'Paid'}
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent className="pb-1">
              <div className="flex items-center gap-3">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(project.paidAmount)}
                </div>
                {!isMonthly && (
                  <div className="flex items-center gap-2 flex-1">
                    <Progress value={progress} className="h-2 flex-1" />
                    <span className="text-sm font-medium text-muted-foreground">{progress}%</span>
                  </div>
                )}
              </div>
              {isMonthly && project.paidAmount > 0 && project.totalAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Math.floor(project.paidAmount / project.totalAmount)} month{Math.floor(project.paidAmount / project.totalAmount) !== 1 ? 's' : ''} paid
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="py-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-1">
              <CardTitle className="text-sm font-medium">
                {isMonthly ? 'Pending Payments' : 'Owed'}
              </CardTitle>
              <Wallet className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </CardHeader>
            <CardContent className="pb-1">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
                {formatCurrency(owedAmount)}
              </div>
              {isMonthly && (
                <p className="text-xs text-muted-foreground">
                  {payments.filter(p => p.status === 'pending').length} pending
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="tasks" className="lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <TabsListBoxed>
          <TabsTriggerBoxed value="tasks" className="gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks
          </TabsTriggerBoxed>
          <TabsTriggerBoxed value="attachments" className="gap-2">
            <Paperclip className="h-4 w-4" />
            Attachments
          </TabsTriggerBoxed>
          <TabsTriggerBoxed value="vault" className="gap-2">
            <KeyRound className="h-4 w-4" />
            Vault
          </TabsTriggerBoxed>
          {!isInternal && project.hasOwnFinances !== false && (
            <TabsTriggerBoxed value="payments" className="gap-2">
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTriggerBoxed>
          )}
          <TabsTriggerBoxed value="details" className="gap-2">
            <Edit className="h-4 w-4" />
            Details
          </TabsTriggerBoxed>
          <TabsTriggerBoxed value="activity" className="gap-2">
            <History className="h-4 w-4" />
            Activity
          </TabsTriggerBoxed>
        </TabsListBoxed>

        <TabsContentBoxed value="tasks" className="lg:flex-1 lg:min-h-0">
          <ProjectTasksTab projectId={id} projectName={project.name} />
        </TabsContentBoxed>

        <TabsContentBoxed value="attachments" className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <ProjectAttachmentsTab projectId={id} />
        </TabsContentBoxed>

        <TabsContentBoxed value="vault" className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <ProjectVaultTab projectId={id} />
        </TabsContentBoxed>

        <TabsContentBoxed value="payments" className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto space-y-6">
          {/* Milestone-based payments */}
          {project.paymentModel === 'milestone' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Milestones</CardTitle>
                    <CardDescription>
                      Track payment milestones for this project
                    </CardDescription>
                  </div>
                  <Dialog
                    open={isMilestoneDialogOpen}
                    onOpenChange={setIsMilestoneDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Milestone
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Milestone</DialogTitle>
                        <DialogDescription>
                          Create a new payment milestone
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Name</Label>
                          <Input
                            placeholder="e.g., Initial Design"
                            value={milestoneForm.name}
                            onChange={(e) =>
                              setMilestoneForm({
                                ...milestoneForm,
                                name: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Amount (EGP)</Label>
                          <Input
                            type="number"
                            placeholder="0"
                            value={milestoneForm.amount}
                            onChange={(e) =>
                              setMilestoneForm({
                                ...milestoneForm,
                                amount: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <DatePicker
                            value={milestoneForm.dueDate}
                            onChange={(date) =>
                              setMilestoneForm({
                                ...milestoneForm,
                                dueDate: date,
                              })
                            }
                            placeholder="Select due date"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setIsMilestoneDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateMilestone}
                          disabled={isSubmitting}
                        >
                          {isSubmitting && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {milestones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Milestone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No milestones yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {milestones.map((milestone) => (
                      <div
                        key={milestone.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              milestone.status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                : milestone.status === 'completed'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
                            }`}
                          >
                            <Milestone className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{milestone.name}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>{formatCurrency(milestone.amount)}</span>
                              <span>Due: {formatDate(milestone.dueDate)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={statusColors.milestone[milestone.status]}
                          >
                            {milestone.status}
                          </Badge>
                          {milestone.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleMilestoneStatusChange(
                                  milestone.id,
                                  'completed'
                                )
                              }
                            >
                              Mark Complete
                            </Button>
                          )}
                          {milestone.status === 'completed' && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleMilestoneStatusChange(milestone.id, 'paid')
                              }
                            >
                              Mark Paid
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditMilestone(milestone)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteMilestone(milestone.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Monthly payments */}
          {project.paymentModel === 'monthly' && (
            <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment History</CardTitle>
                      <CardDescription>
                        Track monthly salary payments
                      </CardDescription>
                    </div>
                    <Dialog
                      open={isPaymentDialogOpen}
                      onOpenChange={setIsPaymentDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Payment
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Monthly Payment</DialogTitle>
                          <DialogDescription>
                            Record a monthly payment entry
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Month</Label>
                            <MonthPicker
                              value={paymentForm.month}
                              onChange={(value) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  month: value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Amount (EGP)</Label>
                            <Input
                              type="number"
                              placeholder={project.totalAmount.toString()}
                              value={paymentForm.amount}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  amount: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea
                              placeholder="Add any notes about this payment..."
                              value={paymentForm.notes}
                              onChange={(e) =>
                                setPaymentForm({
                                  ...paymentForm,
                                  notes: e.target.value,
                                })
                              }
                              rows={3}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => setIsPaymentDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleCreatePayment}
                            disabled={isSubmitting}
                          >
                            {isSubmitting && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Create
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No payment records yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-start gap-4 p-4 rounded-lg border"
                        >
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                              payment.status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
                            }`}
                          >
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{payment.month}</p>
                              {payment.status === 'paid' && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                                  Paid
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(payment.amount)}
                            </p>
                            {payment.notes && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {payment.notes}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditPayment(payment)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {payment.status === 'pending' && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  handleMarkPaymentPaid(payment.id, payment.amount)
                                }
                              >
                                Mark Paid
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
          )}

          {/* Fixed price */}
          {project.paymentModel === 'fixed' && (
            <Card>
              <CardHeader>
                <CardTitle>Fixed Price Payment</CardTitle>
                <CardDescription>
                  Single payment for the entire project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Total Project Value</p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(project.totalAmount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground mb-2">
                      {project.paidAmount > 0 ? 'Partially Paid' : 'Pending Payment'}
                    </p>
                    {project.paidAmount < project.totalAmount ? (
                      <Button
                        onClick={async () => {
                          await updateProject({ paidAmount: project.totalAmount })
                          refetchLogs()
                        }}
                      >
                        Mark as Paid
                      </Button>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      >
                        Fully Paid
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContentBoxed>

        <TabsContentBoxed value="activity" className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {logsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No activity recorded yet</p>
            </div>
          ) : (
            <div className="relative pl-6">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-6">
                {activityLogs.map((log) => {
                  const dotColorMap: Record<string, string> = {
                    created: 'bg-green-500',
                    updated: 'bg-blue-500',
                    status_changed: 'bg-orange-500',
                    task_created: 'bg-green-500',
                    task_archived: 'bg-slate-500',
                    task_restored: 'bg-blue-500',
                    task_deleted: 'bg-red-500',
                    task_status_changed: 'bg-orange-500',
                    comment_added: 'bg-blue-500',
                    comment_deleted: 'bg-slate-500',
                    feature_created: 'bg-purple-500',
                    feature_deleted: 'bg-red-500',
                    vault_entry_added: 'bg-amber-500',
                    vault_entry_deleted: 'bg-red-500',
                  }
                  const actionLabelMap: Record<string, string> = {
                    created: 'Project created',
                    updated: 'Project updated',
                    status_changed: 'Status changed',
                    task_created: 'Task created',
                    task_archived: 'Task archived',
                    task_restored: 'Task restored',
                    task_deleted: 'Task deleted',
                    task_status_changed: 'Task status changed',
                    comment_added: 'Comment added',
                    comment_deleted: 'Comment deleted',
                    feature_created: 'Feature created',
                    feature_deleted: 'Feature deleted',
                    vault_entry_added: 'Vault entry added',
                    vault_entry_deleted: 'Vault entry deleted',
                  }
                  const dotColor = dotColorMap[log.action] || 'bg-blue-500'
                  const actionLabel = actionLabelMap[log.action] || log.action

                  return (
                    <div key={log.id} className="relative group">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 top-1 w-[14px] h-[14px] rounded-full border-2 border-background ${dotColor}`}
                      />

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{actionLabel}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span
                            className="text-xs text-muted-foreground cursor-default"
                            title={formatDateTime(log.createdAt)}
                          >
                            {formatRelativeTime(log.createdAt)}
                          </span>
                          <button
                            onClick={() => deleteLog(log.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete log"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {log.changes.length > 0 && (
                          <div className="space-y-1 ml-0.5">
                            {log.changes.map((change, idx) => {
                              const isEntityChange = ['task', 'feature', 'comment', 'vault', 'task_status'].includes(change.field)
                              if (isEntityChange && change.field === 'task_status') {
                                return (
                                  <div key={idx} className="text-sm text-muted-foreground">
                                    <span className="text-muted-foreground">
                                      {change.oldValue || ''}
                                    </span>
                                    <span className="mx-1.5 text-muted-foreground/60">&rarr;</span>
                                    <span className="text-foreground/80">
                                      {change.newValue || ''}
                                    </span>
                                  </div>
                                )
                              }
                              if (change.field === 'comment_on') {
                                return (
                                  <div key={idx} className="text-sm text-muted-foreground">
                                    on <span className="font-medium text-foreground/80">{change.newValue}</span>
                                  </div>
                                )
                              }
                              if (change.field === 'comment_text') {
                                return (
                                  <div key={idx} className="text-sm text-muted-foreground/80 italic line-clamp-2">
                                    &ldquo;{change.newValue || change.oldValue}&rdquo;
                                  </div>
                                )
                              }
                              if (isEntityChange) {
                                return (
                                  <div key={idx} className="text-sm text-foreground/80">
                                    {change.newValue || change.oldValue}
                                  </div>
                                )
                              }
                              return (
                                <div key={idx} className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground/80">
                                    {projectFieldLabels[change.field] || change.field}
                                  </span>
                                  {': '}
                                  <span className="text-muted-foreground">
                                    {change.oldValue || '(empty)'}
                                  </span>
                                  <span className="mx-1.5 text-muted-foreground/60">&rarr;</span>
                                  <span className="text-foreground/80">
                                    {change.newValue || '(empty)'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContentBoxed>

        <TabsContentBoxed value="details" className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Project Details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {!isInternal && (
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="font-medium">{project.clientName || 'Not specified'}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Payment Model</Label>
                <p className="font-medium capitalize">{project.paymentModel}</p>
              </div>
              {!isInternal ? (
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="font-medium">{formatCurrency(project.totalAmount)}</p>
                </div>
              ) : project.estimatedValue && project.estimatedValue > 0 ? (
                <div>
                  <Label className="text-muted-foreground">Estimated Value</Label>
                  <p className="font-medium">{formatCurrency(project.estimatedValue)}</p>
                </div>
              ) : null}
              <div>
                <Label className="text-muted-foreground">Start Date</Label>
                <p className="font-medium">{formatDate(project.startDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Deadline</Label>
                <p className="font-medium">
                  {project.deadline
                    ? formatDate(project.deadline)
                    : 'Not set'}
                </p>
              </div>
            </div>

            {project.notes && (
              <>
                <Separator />
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p className="mt-1 whitespace-pre-wrap">{project.notes}</p>
                </div>
              </>
            )}
          </div>
        </TabsContentBoxed>
      </Tabs>

      {/* Edit Milestone Dialog */}
      <Dialog open={isEditMilestoneDialogOpen} onOpenChange={(open) => {
        setIsEditMilestoneDialogOpen(open)
        if (!open) setEditingMilestone(null)
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>
              Update the milestone details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g., Initial Design"
                value={milestoneForm.name}
                onChange={(e) =>
                  setMilestoneForm({ ...milestoneForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (EGP)</Label>
              <Input
                type="number"
                placeholder="0"
                value={milestoneForm.amount}
                onChange={(e) =>
                  setMilestoneForm({ ...milestoneForm, amount: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <DatePicker
                value={milestoneForm.dueDate}
                onChange={(date) =>
                  setMilestoneForm({ ...milestoneForm, dueDate: date })
                }
                placeholder="Select due date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditMilestoneDialogOpen(false)
                setEditingMilestone(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditMilestone}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Dialog */}
      <Dialog open={isEditPaymentDialogOpen} onOpenChange={setIsEditPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              Update the payment details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Month</Label>
              <MonthPicker
                value={paymentForm.month}
                onChange={(value) =>
                  setPaymentForm({
                    ...paymentForm,
                    month: value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (EGP)</Label>
              <Input
                type="number"
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    amount: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Add any notes about this payment..."
                value={paymentForm.notes}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    notes: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            {editingPayment?.status === 'paid' && (
              <p className="text-xs text-muted-foreground">
                Note: Changing the amount will adjust the project&apos;s paid total.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditPaymentDialogOpen(false)
                setEditingPayment(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditPayment}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
            <ProjectImagePicker
              value={editForm.coverImageUrl}
              onChange={(url) => setEditForm({ ...editForm, coverImageUrl: url })}
            />

            {/* Brand Color */}
            <div className="space-y-2">
              <Label>Brand Color</Label>
              <div className="flex flex-wrap items-center gap-2">
                {colorPresets.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{
                      backgroundColor: c.value,
                      boxShadow: editForm.color === c.value ? `0 0 0 2px var(--background), 0 0 0 4px ${c.value}` : 'none',
                    }}
                    onClick={() => setEditForm({ ...editForm, color: c.value })}
                    title={c.name}
                  >
                    {editForm.color === c.value && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </button>
                ))}
                {/* Custom color picker */}
                <label
                  className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-muted-foreground/70 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: !colorPresets.some((c) => c.value === editForm.color) ? editForm.color : undefined,
                    boxShadow: !colorPresets.some((c) => c.value === editForm.color) ? `0 0 0 2px var(--background), 0 0 0 4px ${editForm.color}` : 'none',
                    borderStyle: !colorPresets.some((c) => c.value === editForm.color) ? 'solid' : 'dashed',
                    borderColor: !colorPresets.some((c) => c.value === editForm.color) ? 'transparent' : undefined,
                  }}
                  title="Custom color"
                >
                  {!colorPresets.some((c) => c.value === editForm.color) ? (
                    <Check className="h-4 w-4 text-white" />
                  ) : (
                    <Plus className="h-4 w-4 text-muted-foreground/60" />
                  )}
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  />
                </label>
              </div>
            </div>

            {editForm.paymentModel !== 'internal' ? (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Project Name *</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-clientName">Client Name</Label>
                    <Input
                      id="edit-clientName"
                      value={editForm.clientName}
                      onChange={(e) => setEditForm({ ...editForm, clientName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-clientNumber">Client Number</Label>
                  <PhoneInput
                    id="edit-clientNumber"
                    placeholder="Enter phone number"
                    value={editForm.clientNumber}
                    onChange={(value) => setEditForm({ ...editForm, clientNumber: value })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-name">Project Name *</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value as ProjectStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Project Type</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn('w-full justify-between font-normal', !editForm.projectType && 'text-muted-foreground')}
                    >
                      {projectTypes.find((t) => t.value === editForm.projectType)?.label ?? 'Not specified'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search types..." />
                      <CommandList>
                        <CommandEmpty>No type found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Not specified"
                            onSelect={() => setEditForm({ ...editForm, projectType: null })}
                          >
                            <Check className={cn('mr-2 h-4 w-4', !editForm.projectType ? 'opacity-100' : 'opacity-0')} />
                            <span className="text-muted-foreground">Not specified</span>
                          </CommandItem>
                          {projectTypes.map((type) => (
                            <CommandItem
                              key={type.value}
                              value={type.label}
                              onSelect={() => setEditForm({ ...editForm, projectType: type.value })}
                            >
                              <Check className={cn('mr-2 h-4 w-4', editForm.projectType === type.value ? 'opacity-100' : 'opacity-0')} />
                              {type.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Payment Model</Label>
                <Select
                  value={editForm.paymentModel}
                  onValueChange={(value) => setEditForm({ ...editForm, paymentModel: value as PaymentModel })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="milestone">Milestone-based</SelectItem>
                    <SelectItem value="monthly">Monthly Salary</SelectItem>
                    <SelectItem value="fixed">Fixed Price</SelectItem>
                    <SelectItem value="internal">Internal Project</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editForm.paymentModel !== 'internal' ? (
              <div className="space-y-2">
                <Label htmlFor="edit-totalAmount">
                  {editForm.paymentModel === 'monthly' ? 'Monthly Amount' : 'Total Amount'} (EGP)
                </Label>
                <Input
                  id="edit-totalAmount"
                  type="number"
                  value={editForm.totalAmount}
                  onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-estimatedValue">
                  Estimated Value (EGP) - Optional
                </Label>
                <Input
                  id="edit-estimatedValue"
                  type="number"
                  value={editForm.estimatedValue}
                  onChange={(e) => setEditForm({ ...editForm, estimatedValue: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Used for hourly rate calculation in income charts
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <DatePicker
                  value={editForm.startDate}
                  onChange={(date) => setEditForm({ ...editForm, startDate: date })}
                  placeholder="Select start date"
                />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <DatePicker
                  value={editForm.deadline}
                  onChange={(date) => setEditForm({ ...editForm, deadline: date })}
                  placeholder="Select deadline"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditProject} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
