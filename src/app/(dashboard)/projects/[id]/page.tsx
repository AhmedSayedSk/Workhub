'use client'

import { use, useState } from 'react'
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
  AlertDialogAction,
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
import { useSystems } from '@/hooks/useSystems'
import { MilestoneStatus, PaymentModel, MonthlyPayment, ProjectInput } from '@/types'
import { format } from 'date-fns'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
} from '@/lib/utils'
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  Loader2,
  Milestone,
  Plus,
  Trash2,
  Wallet,
  ListTodo,
  Paperclip,
  KeyRound,
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
  const { systems } = useSystems()

  const [isMilestoneDialogOpen, setIsMilestoneDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
    systemId: '',
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    estimatedValue: '',
    startDate: null as Date | null,
    deadline: null as Date | null,
    notes: '',
    coverImageUrl: null as string | null,
  })

  const [paymentForm, setPaymentForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: '',
    notes: '',
  })
  const [editingPayment, setEditingPayment] = useState<MonthlyPayment | null>(null)
  const [isEditPaymentDialogOpen, setIsEditPaymentDialogOpen] = useState(false)

  const system = systems.find((s) => s.id === project?.systemId)

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
      }
    }

    await updateMilestone(milestoneId, updates)
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
  }

  const handleDeleteProject = async () => {
    setIsDeleting(true)
    try {
      await deleteProject()
      router.push('/projects')
    } catch {
      // Error is handled by the hook
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
        systemId: project.systemId,
        paymentModel: project.paymentModel,
        totalAmount: project.totalAmount.toString(),
        estimatedValue: project.estimatedValue?.toString() || '',
        startDate: project.startDate.toDate(),
        deadline: project.deadline ? project.deadline.toDate() : null,
        notes: project.notes,
        coverImageUrl: project.coverImageUrl || null,
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
        systemId: editForm.systemId,
        paymentModel: editForm.paymentModel,
        totalAmount: isEditInternal ? 0 : (parseFloat(editForm.totalAmount) || 0),
        startDate: editForm.startDate,
        deadline: editForm.deadline,
        notes: editForm.notes,
        coverImageUrl: editForm.coverImageUrl,
      }
      if (isEditInternal && editForm.estimatedValue) {
        updateData.estimatedValue = parseFloat(editForm.estimatedValue)
      }
      await updateProject(updateData)
      setIsEditDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <ProjectIcon
            src={project.coverImageUrl}
            name={project.name}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-3 mb-1">
              {system && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: system.color }}
                />
              )}
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              {!isInternal && project.clientName && (
                <span className="text-sm font-medium text-primary">· {project.clientName}</span>
              )}
            </div>
            <p className="text-muted-foreground truncate max-w-2xl" title={project.description}>{project.description}</p>
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
          <Button variant="outline" size="icon" onClick={openEditDialog}>
            <Edit className="h-4 w-4" />
          </Button>

          <Select
            value={project.status}
            onValueChange={(value) =>
              updateProject({ status: value as typeof project.status })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <AlertDialog>
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
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Project'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Overview - Only for non-internal projects */}
      {!isInternal && (
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
          {!isInternal && (
            <TabsTriggerBoxed value="payments" className="gap-2">
              <Wallet className="h-4 w-4" />
              Payments
            </TabsTriggerBoxed>
          )}
          <TabsTriggerBoxed value="details" className="gap-2">
            <Edit className="h-4 w-4" />
            Details
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
                        onClick={() =>
                          updateProject({ paidAmount: project.totalAmount })
                        }
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
                <Label className="text-muted-foreground">System</Label>
                <p className="font-medium">{system?.name || (project.systemId ? 'Unknown' : 'Not assigned')}</p>
              </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ProjectImagePicker
              value={editForm.coverImageUrl}
              onChange={(url) => setEditForm({ ...editForm, coverImageUrl: url })}
            />

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
                <Label>System</Label>
                <Select
                  value={editForm.systemId || 'none'}
                  onValueChange={(value) => setEditForm({ ...editForm, systemId: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span className="text-muted-foreground">No system</span>
                    </SelectItem>
                    {systems.map((sys) => (
                      <SelectItem key={sys.id} value={sys.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: sys.color }}
                          />
                          {sys.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
