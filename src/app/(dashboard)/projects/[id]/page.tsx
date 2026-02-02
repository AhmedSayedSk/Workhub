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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Textarea } from '@/components/ui/textarea'
import { useProject } from '@/hooks/useProjects'
import { useSystems } from '@/hooks/useSystems'
import { MilestoneStatus, PaymentModel } from '@/types'
import { format } from 'date-fns'
import {
  formatCurrency,
  formatDate,
  statusColors,
  calculateProgress,
} from '@/lib/utils'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit,
  Loader2,
  Milestone,
  Plus,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'

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
    dueDate: new Date().toISOString().split('T')[0],
  })

  const [editForm, setEditForm] = useState({
    name: '',
    clientName: '',
    description: '',
    systemId: '',
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    startDate: '',
    deadline: '',
    notes: '',
  })

  const [paymentForm, setPaymentForm] = useState({
    month: new Date().toISOString().slice(0, 7),
    amount: '',
  })

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

  const progress = calculateProgress(project.paidAmount, project.totalAmount)
  const owedAmount = project.totalAmount - project.paidAmount

  const handleCreateMilestone = async () => {
    if (!milestoneForm.name || !milestoneForm.amount) return

    setIsSubmitting(true)
    try {
      await createMilestone({
        name: milestoneForm.name,
        amount: parseFloat(milestoneForm.amount),
        dueDate: new Date(milestoneForm.dueDate),
        status: 'pending',
        completedAt: null,
        paidAt: null,
      })
      setMilestoneForm({
        name: '',
        amount: '',
        dueDate: new Date().toISOString().split('T')[0],
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

      // Update project paid amount
      const milestone = milestones.find((m) => m.id === milestoneId)
      if (milestone) {
        await updateProject({
          paidAmount: project.paidAmount + milestone.amount,
        })
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
      })
      setPaymentForm({
        month: new Date().toISOString().slice(0, 7),
        amount: project.totalAmount.toString(),
      })
      setIsPaymentDialogOpen(false)
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
        description: project.description,
        systemId: project.systemId,
        paymentModel: project.paymentModel,
        totalAmount: project.totalAmount.toString(),
        startDate: format(project.startDate.toDate(), 'yyyy-MM-dd'),
        deadline: project.deadline ? format(project.deadline.toDate(), 'yyyy-MM-dd') : '',
        notes: project.notes,
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleEditProject = async () => {
    if (!editForm.name.trim()) return

    setIsSubmitting(true)
    try {
      await updateProject({
        name: editForm.name,
        clientName: editForm.clientName,
        description: editForm.description,
        systemId: editForm.systemId,
        paymentModel: editForm.paymentModel,
        totalAmount: parseFloat(editForm.totalAmount) || 0,
        startDate: new Date(editForm.startDate),
        deadline: editForm.deadline ? new Date(editForm.deadline) : null,
        notes: editForm.notes,
      })
      setIsEditDialogOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              {system ? (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: system.color }}
                />
              ) : project.systemId ? null : (
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
              )}
              <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
              <Badge
                variant="outline"
                className={statusColors.project[project.status]}
              >
                {project.status}
              </Badge>
            </div>
            {project.clientName && (
              <p className="text-sm font-medium text-primary mb-1">Client: {project.clientName}</p>
            )}
            <p className="text-muted-foreground">{project.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(project.totalAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(project.paidAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Owed</CardTitle>
            <Wallet className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {formatCurrency(owedAmount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{progress}%</div>
            <Progress value={progress} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="payments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-4">
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
                          <Input
                            type="date"
                            value={milestoneForm.dueDate}
                            onChange={(e) =>
                              setMilestoneForm({
                                ...milestoneForm,
                                dueDate: e.target.value,
                              })
                            }
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
                    <CardTitle>Monthly Payments</CardTitle>
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
                          <Input
                            type="month"
                            value={paymentForm.month}
                            onChange={(e) =>
                              setPaymentForm({
                                ...paymentForm,
                                month: e.target.value,
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
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              payment.status === 'paid'
                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
                            }`}
                          >
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{payment.month}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(payment.amount)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {payment.status === 'pending' ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleMarkPaymentPaid(payment.id, payment.amount)
                              }
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
                              Paid
                            </Badge>
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
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p className="font-medium">{project.clientName || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">System</Label>
                  <p className="font-medium">{system?.name || (project.systemId ? 'Unknown' : 'Not assigned')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Model</Label>
                  <p className="font-medium capitalize">{project.paymentModel}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Amount</Label>
                  <p className="font-medium">{formatCurrency(project.totalAmount)}</p>
                </div>
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
                  </SelectContent>
                </Select>
              </div>
            </div>

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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-startDate">Start Date</Label>
                <Input
                  id="edit-startDate"
                  type="date"
                  value={editForm.startDate}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  value={editForm.deadline}
                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
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
