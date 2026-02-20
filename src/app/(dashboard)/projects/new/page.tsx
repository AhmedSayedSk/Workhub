'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { DatePicker } from '@/components/ui/date-picker'
import { PhoneInput } from '@/components/ui/phone-input'
import { projects } from '@/lib/firestore'
import { PaymentModel, ProjectStatus, ProjectType, Project } from '@/types'
import { useToast } from '@/hooks/useToast'
import { cn, colorPresets, projectTypes } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Loader2,
  Milestone,
  Calendar,
  DollarSign,
  Building2,
  Check,
  Plus,
  Palette,
  Users,
  CreditCard,
  CalendarClock,
  FolderKanban,
  Link2,
  ChevronsUpDown,
} from 'lucide-react'
import { ProjectImagePicker } from '@/components/projects/ProjectImagePicker'
import { Suspense } from 'react'

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
  {
    value: 'internal',
    label: 'Internal Project',
    description: 'Brand or internal project with no client payment',
    icon: Building2,
  },
]

const wizardSteps = [
  { id: 'basics', label: 'Basics', icon: Palette },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'client', label: 'Client', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock },
]

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <NewProjectContent />
    </Suspense>
  )
}

function NewProjectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parentId = searchParams.get('parent')
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [parentProject, setParentProject] = useState<Project | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    clientName: '',
    clientNumber: '',
    description: '',
    paymentModel: 'milestone' as PaymentModel,
    totalAmount: '',
    estimatedValue: '',
    startDate: new Date() as Date | null,
    deadline: null as Date | null,
    notes: '',
    coverImageUrl: null as string | null,
    color: colorPresets[0].value,
    projectType: null as ProjectType | null,
    hasOwnFinances: true,
  })

  // Fetch parent project and auto-fill form
  useEffect(() => {
    if (!parentId) return
    projects.getById(parentId).then((parent) => {
      if (!parent) return
      setParentProject(parent)
      setFormData(prev => ({
        ...prev,
        clientName: parent.clientName || '',
        clientNumber: parent.clientNumber || '',
        color: parent.color || colorPresets[0].value,
      }))
    })
  }, [parentId])

  // For internal projects, disable the client step
  const isInternal = formData.paymentModel === 'internal'
  const activeSteps = isInternal
    ? wizardSteps.filter(s => s.id !== 'client')
    : wizardSteps
  const totalSteps = activeSteps.length
  const safeStep = Math.min(currentStep, totalSteps - 1)
  const isLastStep = safeStep === totalSteps - 1
  const currentStepId = activeSteps[safeStep]?.id

  const validateStep = (): boolean => {
    if (currentStepId === 'basics') {
      if (!formData.name.trim()) {
        toast({
          title: 'Error',
          description: 'Project name is required',
          variant: 'destructive',
        })
        return false
      }
    }
    return true
  }

  const handleNext = () => {
    if (!validateStep()) return
    if (safeStep < totalSteps - 1) {
      setCurrentStep(safeStep + 1)
    }
  }

  const handleBack = () => {
    if (safeStep > 0) {
      setCurrentStep(safeStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setIsSubmitting(true)

    try {
      const projectId = await projects.create({
        name: formData.name,
        clientName: formData.clientName,
        clientNumber: formData.clientNumber,
        description: formData.description,
        paymentModel: formData.paymentModel,
        totalAmount: isInternal ? 0 : (parseFloat(formData.totalAmount) || 0),
        paidAmount: 0,
        currency: 'EGP',
        status: 'active' as ProjectStatus,
        startDate: formData.startDate || new Date(),
        deadline: formData.deadline,
        notes: formData.notes,
        coverImageUrl: formData.coverImageUrl,
        color: formData.color,
        projectType: formData.projectType || null,
        parentProjectId: parentId || null,
        hasOwnFinances: formData.hasOwnFinances,
        ...(isInternal && formData.estimatedValue ? { estimatedValue: parseFloat(formData.estimatedValue) } : {}),
      })

      toast({
        description: parentProject ? 'Sub-project created successfully' : 'Project created successfully',
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
        <Link href={parentId ? `/projects/${parentId}` : '/projects'}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {parentProject ? 'New Sub-Project' : 'New Project'}
          </h1>
          <p className="text-muted-foreground">
            {parentProject
              ? <>Creating under <span className="font-medium text-foreground">{parentProject.name}</span></>
              : 'Create a new project to track'}
          </p>
        </div>
      </div>

      {/* Step Indicator — always show all tabs, disable Client for internal */}
      <div className="flex items-center">
        {wizardSteps.map((step, vizIndex) => {
          const isDisabled = isInternal && step.id === 'client'
          // Map visual index to active step index
          const activeIndex = activeSteps.findIndex(s => s.id === step.id)
          const isActive = !isDisabled && activeIndex === safeStep
          const isCompleted = !isDisabled && activeIndex !== -1 && activeIndex < safeStep

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled || activeIndex === safeStep) return
                  if (activeIndex < safeStep) {
                    setCurrentStep(activeIndex)
                  } else {
                    if (validateStep()) setCurrentStep(activeIndex)
                  }
                }}
                className={`flex items-center justify-center px-3 py-2.5 rounded-lg transition-all w-full ${
                  isDisabled
                    ? 'bg-muted/50 text-muted-foreground/30 cursor-not-allowed line-through'
                    : isActive
                      ? 'bg-primary text-primary-foreground shadow-sm cursor-pointer'
                      : isCompleted
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer'
                }`}
              >
                <span className="text-sm font-medium truncate">{step.label}</span>
              </button>
              {vizIndex < wizardSteps.length - 1 && (
                <ChevronRight className={`h-4 w-4 mx-1 shrink-0 ${
                  isCompleted ? 'text-primary/50' : 'text-muted-foreground/30'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step Content */}
      <Card className="h-[640px] flex flex-col overflow-hidden">
        {/* Step 1: Basics */}
        {currentStepId === 'basics' && (
          <>
            <CardHeader className="shrink-0">
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Set up your project identity — name, icon, and brand color
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
              {/* Project Icon */}
              <ProjectImagePicker
                value={formData.coverImageUrl}
                onChange={(url) => setFormData({ ...formData, coverImageUrl: url })}
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
                        boxShadow: formData.color === c.value ? `0 0 0 2px var(--background), 0 0 0 4px ${c.value}` : 'none',
                      }}
                      onClick={() => setFormData({ ...formData, color: c.value })}
                      title={c.name}
                    >
                      {formData.color === c.value && (
                        <Check className="h-4 w-4 text-white" />
                      )}
                    </button>
                  ))}
                  {/* Custom color picker */}
                  <label
                    className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center cursor-pointer hover:border-muted-foreground/70 transition-all relative overflow-hidden"
                    style={{
                      backgroundColor: !colorPresets.some((c) => c.value === formData.color) ? formData.color : undefined,
                      boxShadow: !colorPresets.some((c) => c.value === formData.color) ? `0 0 0 2px var(--background), 0 0 0 4px ${formData.color}` : 'none',
                      borderStyle: !colorPresets.some((c) => c.value === formData.color) ? 'solid' : 'dashed',
                      borderColor: !colorPresets.some((c) => c.value === formData.color) ? 'transparent' : undefined,
                    }}
                    title="Custom color"
                  >
                    {!colorPresets.some((c) => c.value === formData.color) ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground/60" />
                    )}
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Project Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Mobile App Redesign"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
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

              {/* Project Type */}
              <div className="space-y-2">
                <Label>Project Type <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn('w-full justify-between font-normal', !formData.projectType && 'text-muted-foreground')}
                    >
                      {projectTypes.find((t) => t.value === formData.projectType)?.label ?? 'Not specified'}
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
                            onSelect={() => setFormData({ ...formData, projectType: null })}
                          >
                            <Check className={cn('mr-2 h-4 w-4', !formData.projectType ? 'opacity-100' : 'opacity-0')} />
                            <span className="text-muted-foreground">Not specified</span>
                          </CommandItem>
                          {projectTypes.map((type) => (
                            <CommandItem
                              key={type.value}
                              value={type.label}
                              onSelect={() => setFormData({ ...formData, projectType: type.value })}
                            >
                              <Check className={cn('mr-2 h-4 w-4', formData.projectType === type.value ? 'opacity-100' : 'opacity-0')} />
                              {type.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Client & System */}
        {currentStepId === 'client' && (
          <>
            <CardHeader className="shrink-0">
              <CardTitle>Client Details</CardTitle>
              <CardDescription>
                Add client information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
              {/* Client Name & Number */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    placeholder="e.g., Acme Corp"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientNumber">Client Number</Label>
                  <PhoneInput
                    id="clientNumber"
                    placeholder="Enter phone number"
                    value={formData.clientNumber}
                    onChange={(value) => setFormData({ ...formData, clientNumber: value })}
                  />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Payment */}
        {currentStepId === 'payment' && (
          <>
            <CardHeader className="shrink-0">
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>
                Choose how this project will be billed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
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
                        {model.value === 'internal' && formData.paymentModel === 'internal' && (
                          <p className="text-xs text-muted-foreground/70 italic mt-1">Client information step will be skipped</p>
                        )}
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

              {/* Total Amount - Hidden for internal projects */}
              {formData.paymentModel !== 'internal' && (
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
              )}

              {/* Finance Mode - Only when creating sub-project */}
              {parentProject && (
                <div className="space-y-3">
                  <Label>Finance Mode</Label>
                  <div className="grid gap-3">
                    <div
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        formData.hasOwnFinances
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setFormData({ ...formData, hasOwnFinances: true })}
                    >
                      <div className={`p-2 rounded-lg ${formData.hasOwnFinances ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <DollarSign className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Own Finances</p>
                        <p className="text-sm text-muted-foreground">Independent payment tracking and financial stats</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${formData.hasOwnFinances ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {formData.hasOwnFinances && <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                        !formData.hasOwnFinances
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setFormData({ ...formData, hasOwnFinances: false })}
                    >
                      <div className={`p-2 rounded-lg ${!formData.hasOwnFinances ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        <Link2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">Share Parent Finances</p>
                        <p className="text-sm text-muted-foreground">Finances managed at the parent project level</p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 ${!formData.hasOwnFinances ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                        {!formData.hasOwnFinances && <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Estimated Value - Only for internal projects */}
              {formData.paymentModel === 'internal' && (
                <div className="space-y-2">
                  <Label htmlFor="estimatedValue">
                    Estimated Value (EGP) - Optional
                  </Label>
                  <Input
                    id="estimatedValue"
                    type="number"
                    placeholder="0"
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for hourly rate calculation in income charts
                  </p>
                </div>
              )}

            </CardContent>
          </>
        )}

        {/* Step 4: Schedule & Notes */}
        {currentStepId === 'schedule' && (
          <>
            <CardHeader className="shrink-0">
              <CardTitle>Schedule & Notes</CardTitle>
              <CardDescription>
                Set project timeline and any additional notes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1 overflow-y-auto">
              {/* Dates */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker
                    value={formData.startDate}
                    onChange={(date) => setFormData({ ...formData, startDate: date })}
                    placeholder="Select start date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deadline (Optional)</Label>
                  <DatePicker
                    value={formData.deadline}
                    onChange={(date) => setFormData({ ...formData, deadline: date })}
                    placeholder="Select deadline"
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
          </>
        )}
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <div>
          {safeStep === 0 ? (
            <Link href={parentId ? `/projects/${parentId}` : '/projects'}>
              <Button variant="outline">Cancel</Button>
            </Link>
          ) : (
            <Button variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
        </div>
        <div>
          {isLastStep ? (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {parentProject ? 'Create Sub-Project' : 'Create Project'}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
