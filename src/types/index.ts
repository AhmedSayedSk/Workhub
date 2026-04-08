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

export type NoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange'

export interface ProjectNote {
  id: string
  projectId: string
  title: string
  content: string
  color: NoteColor
  pinned: boolean
  tags: string[]
  authorId: string
  authorName: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ProjectNoteInput {
  projectId: string
  title: string
  content: string
  color: NoteColor
  pinned: boolean
  tags: string[]
  authorId: string
  authorName: string
}

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
  milestoneTotalAmount?: number
  currency: Currency
  startDate: Timestamp
  deadline: Timestamp | null
  notes: string
  coverImageUrl: string | null
  estimatedValue?: number // For internal projects - estimated market value for hourly rate calculation
  color: string
  projectType?: ProjectType | null
  parentProjectId: string | null
  mediaFolderId: string | null
  hasOwnFinances: boolean
  repoPath?: string | null
  ownerId: string
  sharedWith: string[] // UIDs of users who can access this project
  pendingSharedEmails: string[] // Emails of users invited but not yet signed up
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
  assigneeIds?: string[]
  skipAutoAssign?: boolean // When true, task will not be auto-assigned to any user or role
  icon?: string | null
  createdAt: Timestamp
}

export interface Subtask {
  id: string
  taskId: string
  name: string
  status: SubtaskStatus
  estimatedMinutes: number
  icon?: string | null
  createdAt: Timestamp
}

export interface TaskComment {
  id: string
  parentId: string
  parentType: CommentParentType
  text: string
  authorId: string
  authorName: string
  audioUrl?: string | null
  audioDuration?: number // seconds
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
  milestoneTotalAmount?: number
  currency: Currency
  startDate: Date
  deadline: Date | null
  notes: string
  coverImageUrl: string | null
  estimatedValue?: number // For internal projects - estimated market value
  color: string
  projectType?: ProjectType | null
  parentProjectId?: string | null
  mediaFolderId?: string | null
  hasOwnFinances?: boolean
  repoPath?: string | null
  ownerId?: string
  sharedWith?: string[]
  pendingSharedEmails?: string[]
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
  assigneeIds?: string[]
  skipAutoAssign?: boolean // When true, task will not be auto-assigned to any user or role
  icon?: string | null
}

export interface SubtaskInput {
  taskId: string
  name: string
  status: SubtaskStatus
  estimatedMinutes: number
  icon?: string | null
}

export interface TaskCommentInput {
  parentId: string
  parentType: CommentParentType
  text: string
  authorId: string
  authorName: string
  audioUrl?: string | null
  audioDuration?: number
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

// User profile stored in Firestore (for lookups by email)
export interface UserProfile {
  id: string
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  lastLoginAt: Timestamp
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

// AI Image Assets (useapi.net reference images)
export interface ImageAsset {
  id: string
  mediaGenerationId: string
  mediaGenerationIds?: Record<string, string> // email → mediaGenerationId mapping
  name: string
  fullUrl: string
  fullStoragePath: string
  thumbnailUrl: string
  storagePath: string
  folderId: string | null
  userId: string
  createdAt: Timestamp
}

export interface ImageAssetFolder {
  id: string
  name: string
  color: string
  userId: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface ImageAssetFolderInput {
  name: string
  color: string
  userId: string
}

// AI Image Generation types (useapi.net)
export type ImageGenModel = 'imagen-4' | 'nano-banana' | 'nano-banana-2' | 'nano-banana-pro'

export type ImageGenAspectRatio = 'landscape' | 'portrait' | 'square'

export interface ImageGeneration {
  id: string
  prompt: string
  aspectRatio: ImageGenAspectRatio
  model: ImageGenModel
  imageUrl: string
  storagePath: string
  mimeType: string
  seed?: number
  fileSize?: number
  savedToMedia: boolean
  mediaFileId?: string
  userId: string
  createdAt: Timestamp
}

// AI Image Generation Log (persistent, never deleted with images)
export interface ImageGenLog {
  id: string
  userId: string
  prompt: string
  model: ImageGenModel
  aspectRatio: ImageGenAspectRatio
  imageCount: number
  status: 'success' | 'failed'
  error?: string
  email?: string
  createdAt: Timestamp
}

export interface AppSettings {
  id: string
  appOwnerUid?: string
  aiModel: GeminiModel
  aiEnabled: boolean
  thinkingTimePercent: number
  vaultPasskey?: string | null
  notifyTimerReminder: boolean
  timerReminderMinutes: number
  notifyDeadlineAlerts: boolean
  deadlineAlertDays: number
  notifyPaymentReminders: boolean
  notifyDailySummary: boolean
  dailySummaryHour: number
  notifyIdleReminder: boolean
  idleReminderMinutes: number
  notifyTaskDue: boolean
  taskDueHoursBefore: number
  notifyBreakReminder: boolean
  breakReminderMinutes: number
  notifyCalendarEvents: boolean
  calendarEventHoursBefore: number
  imageGenApiToken?: string | null
  imageGenModel?: ImageGenModel
  imageGenEnabled?: boolean
  imageGenDisabledEmails?: string[]
  imageGenPreferredEmail?: string | null
  imageGenStandingPrompt?: string | null
  updatedAt: Timestamp
}

export interface AppSettingsInput {
  aiModel: GeminiModel
  aiEnabled: boolean
  thinkingTimePercent?: number
  vaultPasskey?: string | null
  notifyTimerReminder?: boolean
  timerReminderMinutes?: number
  notifyDeadlineAlerts?: boolean
  deadlineAlertDays?: number
  notifyPaymentReminders?: boolean
  notifyDailySummary?: boolean
  dailySummaryHour?: number
  notifyIdleReminder?: boolean
  idleReminderMinutes?: number
  notifyTaskDue?: boolean
  taskDueHoursBefore?: number
  notifyBreakReminder?: boolean
  breakReminderMinutes?: number
  notifyCalendarEvents?: boolean
  calendarEventHoursBefore?: number
  imageGenApiToken?: string | null
  imageGenModel?: ImageGenModel
  imageGenEnabled?: boolean
  imageGenDisabledEmails?: string[]
  imageGenPreferredEmail?: string | null
  imageGenStandingPrompt?: string | null
}

// AI Model types
export type GeminiModel =
  | 'gemini-3-pro-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-2.5-pro-preview-05-06'
  | 'gemini-2.5-flash-preview-05-20'

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
  key?: string // For password type: identifier/key name (e.g., API_KEY, DB_HOST)
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
  key?: string
  value: string
  fileName?: string
  fileSize?: number
  storagePath?: string
}

// Project Activity Log types
export type ProjectLogAction =
  | 'created' | 'updated' | 'status_changed'
  | 'task_created' | 'task_archived' | 'task_restored' | 'task_deleted' | 'task_status_changed'
  | 'comment_added' | 'comment_deleted'
  | 'feature_created' | 'feature_deleted'
  | 'vault_entry_added' | 'vault_entry_deleted'

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

// Claude AI Session types
export type ClaudeSessionStatus = 'running' | 'completed' | 'failed' | 'stopped'

export interface ClaudeSessionTaskResult {
  taskId: string
  taskName: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  branchName: string | null
}

export interface ClaudeSessionFileEdit {
  type: 'create' | 'edit'
  oldString?: string
  newString?: string
  content?: string
}

export interface ClaudeSessionFileChange {
  filePath: string
  shortPath: string
  changeType: 'created' | 'modified'
  edits: ClaudeSessionFileEdit[]
}

export interface ClaudeSession {
  id: string
  projectId: string
  taskIds: string[]
  status: ClaudeSessionStatus
  model: string
  processId: string | null       // Links to server-side child process for interactive input
  waitingForInput: boolean       // Whether Claude is waiting for user response
  startedAt: Timestamp
  completedAt: Timestamp | null
  taskResults: ClaudeSessionTaskResult[]
  summary: string
  transcript: string[]   // JSON-serialized OutputLine objects
  fileChanges: ClaudeSessionFileChange[]
  worktreeBranch: string | null
  lineCount: number
  lastFlushAt: Timestamp | null
  createdAt: Timestamp
}

export interface ClaudeSessionInput {
  projectId: string
  taskIds: string[]
  status: ClaudeSessionStatus
  model: string
  processId?: string | null
  waitingForInput?: boolean
  startedAt: Date
  completedAt: Date | null
  taskResults: ClaudeSessionTaskResult[]
  summary: string
  transcript: string[]
  fileChanges?: ClaudeSessionFileChange[]
  worktreeBranch?: string | null
  lineCount: number
  lastFlushAt: Date | null
}

// Team Member types
export interface Member {
  id: string
  name: string
  role: string
  email: string
  phone: string
  avatarUrl: string | null
  color: string
  createdAt: Timestamp
}

export interface MemberInput {
  name: string
  role: string
  email: string
  phone: string
  avatarUrl: string | null
  color: string
}

// Calendar
export type CalendarEventStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled'

export type CalendarCategory = 'work' | 'meeting' | 'deadline' | 'personal' | 'reminder'

export interface CalendarEvent {
  id: string
  title: string
  description: string
  start: Timestamp
  end: Timestamp
  allDay: boolean
  category: CalendarCategory
  status: CalendarEventStatus
  projectId?: string
  taskId?: string
  imageUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CalendarEventInput {
  title: string
  description: string
  start: Date
  end: Date
  allDay: boolean
  category: CalendarCategory
  status: CalendarEventStatus
  projectId?: string
  taskId?: string
  imageUrl?: string
}

// Permission System
export interface ProjectPermissions {
  viewProject: boolean
  editProject: boolean
  deleteProject: boolean
  viewTasks: boolean
  createTasks: boolean
  editTasks: boolean
  deleteTasks: boolean
  changeTaskStatus: boolean
  archiveTasks: boolean
  viewNotes: boolean
  createEditNotes: boolean
  deleteNotes: boolean
  viewAttachments: boolean
  uploadAttachments: boolean
  deleteAttachments: boolean
  viewVault: boolean
  createEditVault: boolean
  deleteVault: boolean
  viewPayments: boolean
  createEditPayments: boolean
  deletePayments: boolean
  viewActivity: boolean
  viewAiSessions: boolean
  runAiSessions: boolean
  logTime: boolean
  viewAllTimeEntries: boolean
  editDeleteOthersTime: boolean
}

export interface ModulePermissions {
  createProjects: boolean
  viewCalendar: boolean
  createEditCalendar: boolean
  deleteCalendar: boolean
  viewMedia: boolean
  uploadMedia: boolean
  deleteMedia: boolean
  viewFinances: boolean
  viewTimesheets: boolean
  accessAiAssistant: boolean
  accessImageGenerator: boolean
  accessSettings: boolean
}

export interface MemberPermission {
  id: string
  memberId: string
  memberUid: string
  projectId: string // "__global__" for module permissions
  permissions?: ProjectPermissions
  modules?: ModulePermissions
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Audit Logs
export type AuditLogType =
  | 'login' | 'login_failed' | 'logout'
  | 'project' | 'task' | 'comment' | 'feature' | 'vault'
  | 'permission' | 'member' | 'sharing'
  | 'settings' | 'media' | 'payment' | 'calendar'
  | 'attachment'

export interface AuditLog {
  id: string
  type: AuditLogType
  action: string
  actorUid: string | null
  actorEmail: string
  projectId?: string
  projectName?: string
  targetId?: string
  targetName?: string
  details?: Record<string, any>
  createdAt: Timestamp
}

export type AuditLogInput = Omit<AuditLog, 'id' | 'createdAt'>
