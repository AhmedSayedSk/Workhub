import { Timestamp } from 'firebase/firestore'

// Base types
export type Currency = 'EGP'

export type PaymentModel = 'milestone' | 'monthly' | 'fixed' | 'internal'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type FeatureStatus = 'pending' | 'in_progress' | 'completed'

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type TaskType = 'task' | 'bug' | 'feature' | 'improvement' | 'documentation' | 'research'

export type SubtaskStatus = 'todo' | 'in_progress' | 'done'

export type Priority = 'low' | 'medium' | 'high'

export type CommentParentType = 'task' | 'subtask'

export type MilestoneStatus = 'pending' | 'completed' | 'paid'

export type PaymentStatus = 'pending' | 'paid'

export type ProjectType =
  | 'website'
  | 'saas'
  | 'admin_panel'
  | 'mobile_app'
  | 'desktop_app'
  | 'landing_page'
  | 'ecommerce'
  | 'api'
  | 'cms'
  | 'erp'
  | 'crm'
  | 'dashboard'
  | 'portfolio'
  | 'blog'
  | 'game'
  | 'browser_extension'
  | 'cli_tool'
  | 'library'
  | 'other'

export type AISuggestionContext = 'task_breakdown' | 'time_estimate' | 'insight'

// Firestore document types
export interface Organization {
  id: string
  name: string
  createdAt: Timestamp
}

export interface Project {
  id: string
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
  estimatedValue?: number // For internal projects - estimated market value for hourly rate calculation
  color: string
  projectType?: ProjectType | null
  parentProjectId: string | null
  hasOwnFinances: boolean
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
  taskType: TaskType
  priority: Priority
  estimatedHours: number
  actualHours: number
  sortOrder: number
  archived?: boolean
  archivedAt?: Timestamp
  waiting?: boolean
  waitingAt?: Timestamp
  waitingReason?: string
  deadline?: Timestamp | null
  doneAt?: Timestamp
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

export interface TaskComment {
  id: string
  parentId: string
  parentType: CommentParentType
  text: string
  authorId: string
  authorName: string
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
  notes: string
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

export interface ProjectInput {
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
  estimatedValue?: number // For internal projects - estimated market value
  color: string
  projectType?: ProjectType | null
  parentProjectId?: string | null
  hasOwnFinances?: boolean
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
  taskType?: TaskType
  priority: Priority
  estimatedHours: number
  sortOrder?: number
  archived?: boolean
  archivedAt?: Timestamp | null
  waiting?: boolean
  waitingAt?: Timestamp | null
  waitingReason?: string
  deadline?: Timestamp | null
  doneAt?: Timestamp | null
}

export interface SubtaskInput {
  taskId: string
  name: string
  status: SubtaskStatus
  estimatedMinutes: number
}

export interface TaskCommentInput {
  parentId: string
  parentType: CommentParentType
  text: string
  authorId: string
  authorName: string
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
  notes: string
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
  status?: ProjectStatus
  paymentModel?: PaymentModel
}

export interface TaskFilters {
  projectId?: string
  featureId?: string
  status?: TaskStatus
  taskType?: TaskType
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
  thinkingTimePercent: number
  updatedAt: Timestamp
}

export interface AppSettingsInput {
  aiModel: GeminiModel
  aiEnabled: boolean
  thinkingTimePercent?: number
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

// Project Vault types
export type VaultEntryType = 'text' | 'password' | 'file'

export interface VaultEntry {
  id: string
  projectId: string
  type: VaultEntryType
  label: string
  value: string // For text/password: the content. For file: the file URL
  fileName?: string // For file type: original file name
  fileSize?: number // For file type: file size in bytes
  storagePath?: string // For file type: storage path for deletion
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface VaultEntryInput {
  projectId: string
  type: VaultEntryType
  label: string
  value: string
  fileName?: string
  fileSize?: number
  storagePath?: string
}

// Project Activity Log types
export type ProjectLogAction = 'created' | 'updated' | 'status_changed'

export interface ProjectLogChange {
  field: string
  oldValue: string | null
  newValue: string | null
}

export interface ProjectLog {
  id: string
  projectId: string
  action: ProjectLogAction
  changes: ProjectLogChange[]
  createdAt: Timestamp
}
