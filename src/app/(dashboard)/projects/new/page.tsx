'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSystems } from '@/hooks/useSystems'
import { projects } from '@/lib/firestore'
import { PaymentModel, ProjectStatus } from '@/types'
import { useToast } from '@/hooks/useToast'
import { ArrowLeft, Loader2, Milestone, Calendar, DollarSign } from 'lucide-react'

const paymentModels: { value: PaymentModel; label: string; description: string; icon: typeof Milestone }[] = [
  {
    value: 'milestone',
    label: 'Milestone-based',
    description: 'Payment distributed across project milestones',
    icon: Milestone,
  },
  {
    value: 'monthly',
    label: 'Monthly Salary',
    description: 'Recurring monthly payment',
    icon: Calendar,
  },
  {
    value: 'fixed',
    label: 'Fixed Price',
    description: 'Single payment for entire project',
    icon: DollarSign,
  },
]

export default function NewProjectPage() {
  const router = useRouter()
  const { systems, loading: systemsLoading } = useSystems()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    clientName: '',
    description: '',
    systemId: '',
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    deadline: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Project name is required',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const projectId = await projects.create({
        name: formData.name,
        clientName: formData.clientName,
        description: formData.description,
        systemId: formData.systemId,
        paymentModel: formData.paymentModel,
        totalAmount: parseFloat(formData.totalAmount) || 0,
        paidAmount: 0,
        currency: 'EGP',
        status: 'active' as ProjectStatus,
        startDate: new Date(formData.startDate),
        deadline: formData.deadline ? new Date(formData.deadline) : null,
        notes: formData.notes,
      })

      toast({
        title: 'Success',
        description: 'Project created successfully',
        variant: 'success',
      })

      router.push(`/projects/${projectId}`)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to create project',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Project</h1>
          <p className="text-muted-foreground">Create a new project to track</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Project Details</CardTitle>
            <CardDescription>
              Enter the basic information about your project
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Mobile App Redesign"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label htmlFor="clientName">Client Name</Label>
              <Input
                id="clientName"
                placeholder="e.g., Acme Corp"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the project..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* System */}
            <div className="space-y-2">
              <Label>System</Label>
              <Select
                value={formData.systemId || 'none'}
                onValueChange={(value) => setFormData({ ...formData, systemId: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a system (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No system</span>
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
            </div>

            {/* Payment Model */}
            <div className="space-y-3">
              <Label>Payment Model</Label>
              <div className="grid gap-3">
                {paymentModels.map((model) => (
                  <div
                    key={model.value}
                    className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.paymentModel === model.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setFormData({ ...formData, paymentModel: model.value })}
                  >
                    <div
                      className={`p-2 rounded-lg ${
                        formData.paymentModel === model.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <model.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{model.label}</p>
                      <p className="text-sm text-muted-foreground">{model.description}</p>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border-2 ${
                        formData.paymentModel === model.value
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground'
                      }`}
                    >
                      {formData.paymentModel === model.value && (
                        <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Amount */}
            <div className="space-y-2">
              <Label htmlFor="totalAmount">
                {formData.paymentModel === 'monthly' ? 'Monthly Amount' : 'Total Amount'} (EGP)
              </Label>
              <Input
                id="totalAmount"
                type="number"
                placeholder="0"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
              />
            </div>

            {/* Dates */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Link href="/projects">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Project
          </Button>
        </div>
      </form>
    </div>
  )
}
