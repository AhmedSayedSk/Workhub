import { Timestamp } from 'firebase/firestore'

// Base types
export type Currency = 'EGP'

export type PaymentModel = 'milestone' | 'monthly' | 'fixed'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type FeatureStatus = 'pending' | 'in_progress' | 'completed'

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type SubtaskStatus = 'todo' | 'in_progress' | 'done'

export type Priority = 'low' | 'medium' | 'high'

export type MilestoneStatus = 'pending' | 'completed' | 'paid'

export type PaymentStatus = 'pending' | 'paid'

export type AISuggestionContext = 'task_breakdown' | 'time_estimate' | 'insight'

// Firestore document types
export interface Organization {
  id: string
  name: string
  createdAt: Timestamp
}

export interface System {
  id: string
  organizationId: string
  name: string
  description: string
  color: string
  createdAt: Timestamp
}

export interface Project {
  id: string
  systemId: string
  name: string
  clientName: string
  clientNumber: string
  description: string
  status: ProjectStatus
  paymentModel: PaymentModel
  totalAmount: number
  paidAmount: number
  currency: Currency
  startDate: Timestamp
  deadline: Timestamp | null
  notes: string
  coverImageUrl: string | null
  createdAt: Timestamp
}

export interface Milestone {
  id: string
  projectId: string
  name: string
  amount: number
  status: MilestoneStatus
  dueDate: Timestamp
  completedAt: Timestamp | null
  paidAt: Timestamp | null
}

export interface Feature {
  id: string
  projectId: string
  name: string
  description: string
  status: FeatureStatus
  priority: Priority
  estimatedHours: number
  icon: string | null
  createdAt: Timestamp
}

export interface Task {
  id: string
  featureId: string
  projectId: string
  name: string
  description: string
  status: TaskStatus
  priority: Priority
  estimatedHours: number
  actualHours: number
  createdAt: Timestamp
}

export interface Subtask {
  id: string
  taskId: string
  name: string
  status: SubtaskStatus
  estimatedMinutes: number
  createdAt: Timestamp
}

export interface TimeEntry {
  id: string
  subtaskId: string
  taskId: string
  projectId: string
  startTime: Timestamp
  endTime: Timestamp | null
  duration: number // minutes
  notes: string
  isManual: boolean
  createdAt: Timestamp
}

export interface MonthlyPayment {
  id: string
  projectId: string
  month: string // YYYY-MM
  amount: number
  status: PaymentStatus
  paidAt: Timestamp | null
}

export interface AISuggestion {
  id: string
  context: AISuggestionContext
  entityType: string
  entityId: string
  suggestion: string
  accepted: boolean
  createdAt: Timestamp
}

// Form/Input types (without id and timestamps)
export interface OrganizationInput {
  name: string
}

export interface SystemInput {
  organizationId: string
  name: string
  description: string
  color: string
}

export interface ProjectInput {
  systemId: string
  name: string
  clientName: string
  clientNumber: string
  description: string
  status: ProjectStatus
  paymentModel: PaymentModel
  totalAmount: number
  paidAmount: number
  currency: Currency
  startDate: Date
  deadline: Date | null
  notes: string
  coverImageUrl: string | null
}

export interface MilestoneInput {
  projectId: string
  name: string
  amount: number
  status: MilestoneStatus
  dueDate: Date
  completedAt: Date | null
  paidAt: Date | null
}

export interface FeatureInput {
  projectId: string
  name: string
  description: string
  status: FeatureStatus
  priority: Priority
  estimatedHours: number
  icon: string | null
}

export interface TaskInput {
  featureId: string
  projectId: string
  name: string
  description: string
  status: TaskStatus
  priority: Priority
  estimatedHours: number
}

export interface SubtaskInput {
  taskId: string
  name: string
  status: SubtaskStatus
  estimatedMinutes: number
}

export interface TimeEntryInput {
  subtaskId: string
  taskId: string
  projectId: string
  startTime: Date
  endTime: Date | null
  duration: number
  notes: string
  isManual: boolean
}

export interface MonthlyPaymentInput {
  projectId: string
  month: string
  amount: number
  status: PaymentStatus
  paidAt: Date | null
}

// UI/State types
export interface TimerState {
  isRunning: boolean
  isPaused: boolean
  startTime: Date | null
  pausedTime: number // accumulated paused milliseconds
  currentSubtaskId: string | null
  currentTaskId: string | null
  currentProjectId: string | null
}

export interface DashboardStats {
  activeProjects: number
  totalOwed: number
  todayTasks: number
  todayHours: number
  weeklyHours: number
}

export interface ProjectWithSystem extends Project {
  system: System
}

export interface TaskWithFeature extends Task {
  feature: Feature
}

export interface TimeEntryWithDetails extends TimeEntry {
  task: Task
  project: Project
}

// Auth types
export interface User {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}

// API Response types
export interface AIResponse {
  success: boolean
  data?: {
    suggestions?: string[]
    estimate?: number
    insight?: string
  }
  error?: string
}

// Chart data types
export interface ChartDataPoint {
  name: string
  value: number
  color?: string
}

export interface TimeChartData {
  date: string
  hours: number
}

export interface FinanceChartData {
  month: string
  earned: number
  pending: number
}

// Filter types
export interface ProjectFilters {
  systemId?: string
  status?: ProjectStatus
  paymentModel?: PaymentModel
}

export interface TaskFilters {
  projectId?: string
  featureId?: string
  status?: TaskStatus
  priority?: Priority
}

export interface TimeFilters {
  projectId?: string
  startDate?: Date
  endDate?: Date
}

// AI Model types
export type GeminiModel =
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-2.5-pro-preview-05-06'
  | 'gemini-2.5-flash-preview-05-20'

export interface AppSettings {
  id: string
  aiModel: GeminiModel
  aiEnabled: boolean
  updatedAt: Timestamp
}

export interface AppSettingsInput {
  aiModel: GeminiModel
  aiEnabled: boolean
}

// Media Library types
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other'

export type MediaViewMode = 'grid' | 'list'

export type MediaSortBy = 'name' | 'date' | 'size' | 'type'

export type MediaSortOrder = 'asc' | 'desc'

export interface MediaFile {
  id: string
  name: string
  displayName: string
  mimeType: string
  category: FileCategory
  size: number
  url: string
  storagePath: string
  thumbnailUrl: string | null
  folderId: string | null
  linkedProjects: string[]
  linkedTasks: string[]
  uploadedBy: string
  metadata: Record<string, string>
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface MediaFolder {
  id: string
  name: string
  parentId: string | null
  color: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface MediaFileInput {
  name: string
  displayName: string
  mimeType: string
  category: FileCategory
  size: number
  url: string
  storagePath: string
  thumbnailUrl: string | null
  folderId: string | null
  linkedProjects: string[]
  linkedTasks: string[]
  uploadedBy: string
  metadata: Record<string, string>
}

export interface MediaFolderInput {
  name: string
  parentId: string | null
  color: string
  createdBy: string
}

export interface UploadProgress {
  fileId: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error'
  error?: string
}

export interface MediaFilters {
  search?: string
  category?: FileCategory
  folderId?: string | null
  sortBy?: MediaSortBy
  sortOrder?: MediaSortOrder
}
