import { Timestamp } from 'firebase/firestore'

// Base types
export type Currency = 'EGP'

export type PaymentModel = 'milestone' | 'monthly' | 'fixed' | 'internal'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'cancelled'

export type ProjectStage = 'next' | 'shape' | 'design' | 'build' | 'deploy' | 'market' | 'launch' | 'repos'

export const PROJECT_STAGES: ProjectStage[] = ['next', 'shape', 'design', 'build', 'deploy', 'market', 'launch', 'repos']

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
  ownerId: string
  sharedWith: string[] // UIDs of users who can access this project
  pendingSharedEmails: string[] // Emails of users invited but not yet signed up
  distribution?: ProjectDistribution
  sikagitProjectId?: string | null
  /** Link to a single sikagit repo instead of a full sikagit project (for one-repo products). */
  sikagitRepoId?: string | null
  /** Optional grouping label among sibling sub-projects (e.g. "Browser Extensions", "Open Source"). */
  group?: string | null
  /** For parent/org projects: the canonical list of sub-project groups. */
  subGroups?: string[]
  enabledStages: ProjectStage[]
  lastTouchedStage?: ProjectStage | null
  lastTouchedAt?: Timestamp
  createdAt: Timestamp
  warrantyDays?: number
  warrantyStartDate?: Timestamp | null
  sortOrder?: number // Manual ordering among siblings (sub-projects of the same parent)
}

// Dynamic Equity Split / Effort-Based Profit Sharing
export interface DistributionCategory {
  id: string
  name: string
  weight: number // 0–100; all category weights sum to 100
  isCustom: boolean
}

export interface DistributionPartner {
  memberId: string
  allocations: Record<string, number> // categoryId → 0–100 (sums to 100 per category)
}

export interface ProjectDistribution {
  enabled: boolean
  categories: DistributionCategory[]
  partners: DistributionPartner[]
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
  hiddenFromDashboard?: boolean // When true, task is hidden from dashboard "My Tasks" / "Team Tasks" cards
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

export interface TaskQuestion {
  id: string
  taskId: string
  taskName: string
  projectId: string
  projectName: string
  question: string
  answer: string | null
  askedBy: string
  askedAt: Timestamp
  answeredAt: Timestamp | null
  answeredBy: string | null
}

export interface TaskQuestionInput {
  taskId: string
  taskName: string
  projectId: string
  projectName: string
  question: string
  askedBy: string
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
  ownerId?: string
  sharedWith?: string[]
  pendingSharedEmails?: string[]
  warrantyDays?: number
  warrantyStartDate?: Date | null
  distribution?: ProjectDistribution
  sikagitProjectId?: string | null
  /** Link to a single sikagit repo instead of a full sikagit project (for one-repo products). */
  sikagitRepoId?: string | null
  /** Optional grouping label among sibling sub-projects (e.g. "Browser Extensions", "Open Source"). */
  group?: string | null
  /** For parent/org projects: the canonical list of sub-project groups. */
  subGroups?: string[]
  enabledStages?: ProjectStage[]
  sortOrder?: number
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
  hiddenFromDashboard?: boolean
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
  sessionId?: string
  createdAt: Timestamp
}

// A named image-generation "session" (thread) with its own standing prompt, so
// images created within it stay stylistically coherent with each other.
export interface ImageGenSession {
  id: string
  userId: string
  name: string
  standingPrompt: string
  createdAt: Timestamp
  updatedAt?: Timestamp
  lastUsedAt?: Timestamp
}

// ── Campaign Creator ────────────────────────────────────────────────────────
// Authoring layer: a campaign holds a plan + draft posts; on schedule each post
// is handed off to the existing socialPosts system for FB/IG publishing.
export type CampaignLanguage = 'en' | 'ar'
export type CampaignStatus = 'draft' | 'planning' | 'ready' | 'scheduled' | 'done'
export type CampaignPostStatus = 'planned' | 'approved' | 'generating' | 'ready' | 'scheduled'
export type CampaignAspect = 'landscape' | 'square' | 'portrait'
export type CampaignTextOption = 'none' | 'short' | 'long' // render post text ON the image

export interface CampaignContentEmphasis {
  includeLink: boolean // include the project link as a CTA in the posts
  link?: string // the URL to include (used when includeLink)
  includeHowTo: boolean // dedicate a post to how to use the product
  includeEdge: boolean // dedicate a post to benefits vs competitors
  edge?: string // optional competitors / differentiators context for the AI
}

export interface CampaignBrief {
  goal: string
  audience: string
  tone: string
  count: number
  startDate: string // ISO date YYYY-MM-DD
  cadenceDays: number // days between posts
  postTime: string // HH:mm local, e.g. "18:00"
  content?: CampaignContentEmphasis // what each post should mention (link / how-to / competitor edge)
  cta?: string // call-to-action directive ('' = auto): steers caption CTAs + the video's closing scene
}

export interface CampaignBrand {
  name: string
  colors: string[]
  logoUrl: string | null
}

export interface Campaign {
  id: string
  projectId: string
  name: string
  brief: CampaignBrief
  brand: CampaignBrand
  language: CampaignLanguage
  platforms: SocialPlatform[]
  style?: string // image style key (see lib/campaignStyles)
  aspect?: CampaignAspect // image aspect for all posts (portrait/square/landscape)
  consistentIdentity?: boolean // generate one shared art direction for all posts
  artDirection?: string // the shared visual identity, applied to every image
  imageInstructions?: string // user's custom instructions applied to every image
  textOnImage?: CampaignTextOption // render post headline/body text on the generated image
  brandImageUrl?: string // logo/custom image fed as a reference into every generation
  brandImageRefs?: Record<string, string> // per-account mediaGenerationIds for the brand reference
  status: CampaignStatus
  postCount?: number
  scheduledCount?: number
  adgenCampaignId?: string // the AdGen campaign this plan came from (hooks + video need it)
  planError?: string | null
  createdBy: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface CampaignPost {
  id: string
  campaignId: string
  order: number
  caption: string
  hashtags: string[]
  imagePrompt: string
  headline?: string // short text to render on the image
  body?: string // longer text to render on the image
  aspect: CampaignAspect
  imageUrl: string | null
  thumbnailUrl?: string | null
  model?: string // the image model that generated it
  status: CampaignPostStatus
  socialPostId: string | null
  scheduledAt: Timestamp | null
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export type RenderAspect = 'portrait' | 'landscape' | 'square'
export type RenderJobStatus = 'queued' | 'rendering' | 'done' | 'failed' | 'cancelled'

export interface RenderJob {
  id: string
  campaignId: string
  projectId: string
  status: RenderJobStatus
  aspect: RenderAspect
  hook: { headline: string; subtext: string; bgPrompt: string }
  brand: { name: string; color: string; logoUrl: string | null; domain?: string }
  scenes: Array<{ imageUrl: string; headline: string; caption: string }>
  mode?: RenderMode
  lang?: 'ar' | 'en' // drives RTL + Arabic font in creative templates
  market?: string // target market code — culture-adapts copy + narration
  sceneStyles?: string[] // enabled showcase compositions (Scene Styles table)
  cancelRequested?: boolean // set by the Stop button; worker aborts at next checkpoint
  voiceover?: { enabled: boolean; language: 'en' | 'ar'; gender: 'male' | 'female' | 'mixed'; voice?: string; model?: 'standard' | 'premium'; rate?: number; rateAuto?: boolean; style?: string } // AI narration (voice = named voice id; style = market delivery direction)
  transition?: 'smooth' | 'simple' | 'none' | 'cinematic' | 'push' // exit-fade+dissolve / exit-fade / hard cut / xfade reveals (circle·radial·diag) / whip-slide pushes
  palette?: { bg1: string; bg2: string; accent: string; text: string; muted: string; ctaText: string } // AI-proposed, contrast-enforced color system
  sfx?: { enabled: boolean } // sound effects mixed at scene-motion moments (default on)
  captions?: boolean // word-synced karaoke captions burned onto narrated scenes (default on with voiceover)
  arFont?: string // Arabic display font id (cairo default — see AR_FONTS in the worker)
  subtitles?: boolean // 'Speak subtitles': voiceover reads the sub (never displayed on screen)
  videoHook?: boolean // stock-footage hook background (Pexels) instead of the AI image
  hookVideoQuery?: string // English stock-search query for the hook clip
  script?: CreativeScene[]
  videoUrl?: string
  thumbnailUrl?: string
  error?: string
  progress?: number // 0-100, updated live by the render worker
  stage?: string // 'preparing' | 'hook' | 'rendering' | 'encoding' | 'uploading' | 'done'
  workerId?: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
}

export type RenderMode = 'basic' | 'creative'

export type CreativeScene =
  | { type: 'hook'; headline: string; underline?: string; kicker?: string }
  | { type: 'beat'; title: string; sub?: string }
  | { type: 'stat'; value: string; label: string }
  | { type: 'showcase'; imageUrl: string; caption?: string; sub?: string } // one scene: image (top) + its copy (bottom)
  | { type: 'cta'; text: string; url?: string }

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
  defaultDistributionCategories?: DistributionCategoryDefault[]
  emailNotificationsEnabled?: boolean
  sikagitDbPath?: string | null
  sikagitPathPrefix?: string | null
  updatedAt: Timestamp
}

export interface DistributionCategoryDefault {
  id: string
  name: string
  weight: number
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
  defaultDistributionCategories?: DistributionCategoryDefault[]
  emailNotificationsEnabled?: boolean
  sikagitDbPath?: string | null
  sikagitPathPrefix?: string | null
}

// AI Model types
export type GeminiModel =
  | 'gemini-pro-latest'
  | 'gemini-3.1-pro-preview'
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
  viewTeam: boolean
  createEditTeam: boolean
  deleteTeam: boolean
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
  | 'project' | 'task' | 'subtask' | 'comment' | 'feature' | 'vault'
  | 'permission' | 'member' | 'sharing'
  | 'settings' | 'media' | 'payment' | 'calendar'
  | 'attachment' | 'note' | 'time_entry' | 'milestone'
  | 'stage'

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

// ===== Project Stage: Shape =====
export interface ProjectShape {
  projectId: string
  visionStatement: string
  inScope: string[]
  outOfScope: string[]
  constraints: string[]
  updatedAt: Timestamp
}

export type DecisionStatus = 'open' | 'decided' | 'reversed'

export interface Decision {
  id: string
  projectId: string
  title: string
  rationale: string
  status: DecisionStatus
  decidedAt: Timestamp
  authorId: string
}

export interface DecisionInput {
  projectId: string
  title: string
  rationale: string
  status: DecisionStatus
  authorId: string
}

// ===== Project Stage: Market =====
export interface ProjectMarket {
  projectId: string
  positioning: string
  audience: string
  pricing: string
  updatedAt: Timestamp
}

export type MarketChannelStatus = 'planned' | 'active' | 'paused' | 'completed'

export interface MarketChannel {
  id: string
  projectId: string
  name: string
  status: MarketChannelStatus
  url?: string | null
}

export interface MarketChannelInput {
  projectId: string
  name: string
  status: MarketChannelStatus
  url?: string | null
}

// ===== Project Stage: Next (AI compass) =====

export type NextStepStatus = 'pending' | 'skipped' | 'done'
export type NextStepEffort = 'minutes' | 'hours' | 'days'

export interface NextStep {
  id: string
  projectId: string
  /** Imperative action, max ~14 words. */
  title: string
  /** Why this is the highest-leverage move right now. */
  why: string
  /** Concrete how-to, 2-4 sentences. */
  how: string
  /** Which stage this action belongs to. */
  stage: ProjectStage
  effort: NextStepEffort
  /** Rank within its generated batch (1 = top). */
  rank: number
  status: NextStepStatus
  createdAt: Timestamp
  resolvedAt?: Timestamp | null
}

export interface NextStepInput {
  projectId: string
  title: string
  why: string
  how: string
  stage: ProjectStage
  effort: NextStepEffort
  rank: number
}

// ===== Project Stage: Design (pre-code) =====

export interface DesignColor {
  name: string
  /** Hex value, e.g. #E66A4C */
  value: string
}

export interface ProjectDesign {
  projectId: string
  /** Conventions & free-form notes about the design system. */
  designSystemNotes: string
  /** Structured palette — rendered as swatches. */
  colors?: DesignColor[]
  /** Font families in use. */
  fonts?: string[]
  /** Icon set, e.g. 'Phosphor 2.1.1' or 'Lucide'. */
  iconSet?: string | null
  updatedAt: Timestamp
}

export type DesignPrototypeKind = 'html' | 'figma' | 'live' | 'other'
export type DesignPrototypeStatus = 'draft' | 'final'

export interface DesignPrototype {
  id: string
  projectId: string
  name: string
  /** URL or local file path to the prototype. */
  url: string
  kind: DesignPrototypeKind
  status: DesignPrototypeStatus
  notes?: string | null
}

export interface DesignPrototypeInput {
  projectId: string
  name: string
  url: string
  kind: DesignPrototypeKind
  status?: DesignPrototypeStatus
  notes?: string | null
}

export type DesignScreenStatus = 'todo' | 'designed' | 'approved'

export interface DesignScreen {
  id: string
  projectId: string
  /** Surface grouping, e.g. 'Cashier (mobile)' or 'Admin (desktop)'. */
  group: string
  title: string
  status: DesignScreenStatus
  order: number
}

export interface DesignScreenInput {
  projectId: string
  group: string
  title: string
  status?: DesignScreenStatus
  order?: number
}

export interface DesignImage {
  id: string
  projectId: string
  url: string
  caption?: string | null
}

export interface DesignImageInput {
  projectId: string
  url: string
  caption?: string | null
}

// Marketplace distribution (Market stage)
export type MarketListingModel = 'one_time' | 'subscription' | 'freemium'
export type MarketListingStatus = 'preparing' | 'submitted' | 'approved' | 'rejected' | 'live'

export interface MarketListing {
  id: string
  projectId: string
  marketplace: string
  model: MarketListingModel
  status: MarketListingStatus
  price?: string | null
  url?: string | null
  notes?: string | null
  createdAt: Timestamp
}

export interface MarketListingInput {
  projectId: string
  marketplace: string
  model?: MarketListingModel
  status?: MarketListingStatus
  price?: string | null
  url?: string | null
  notes?: string | null
}

// Guided go-to-market (Market stage)
export type MarketPlaybookPhase = 'pre_launch' | 'launch' | 'post_launch'
export type MarketPlaybookStatus = 'todo' | 'doing' | 'done'

export interface MarketPlaybookItem {
  id: string
  projectId: string
  phase: MarketPlaybookPhase
  title: string
  detail: string
  status: MarketPlaybookStatus
  order: number
  createdAt: Timestamp
}

export interface MarketPlaybookItemInput {
  projectId: string
  phase: MarketPlaybookPhase
  title: string
  detail: string
  status?: MarketPlaybookStatus
  order?: number
}

export type MarketCampaignStatus = 'planned' | 'running' | 'done'

export interface MarketCampaign {
  id: string
  projectId: string
  name: string
  channel: string
  status: MarketCampaignStatus
  notes?: string | null
  result?: string | null
  createdAt: Timestamp
}

export interface MarketCampaignInput {
  projectId: string
  name: string
  channel: string
  status?: MarketCampaignStatus
  notes?: string | null
  result?: string | null
}

export type LaunchAssetStatus = 'not_started' | 'in_progress' | 'done'

export interface LaunchAsset {
  id: string
  projectId: string
  name: string
  status: LaunchAssetStatus
  url?: string | null
  ownerId?: string | null
}

export interface LaunchAssetInput {
  projectId: string
  name: string
  status: LaunchAssetStatus
  url?: string | null
  ownerId?: string | null
}

// ===== Project Stage: Launch =====
export type LaunchStatus = 'planned' | 'in_review' | 'live'

export interface ProjectLaunch {
  projectId: string
  releaseDate?: Timestamp | null
  status: LaunchStatus
  updatedAt: Timestamp
}

export type LaunchChecklistStatus = 'not_started' | 'in_progress' | 'done'

export interface LaunchChecklistItem {
  id: string
  projectId: string
  title: string
  status: LaunchChecklistStatus
  dueDate?: Timestamp | null
  ownerId?: string | null
}

export interface LaunchChecklistItemInput {
  projectId: string
  title: string
  status: LaunchChecklistStatus
  dueDate?: Timestamp | null
  ownerId?: string | null
}

export interface MonitoringLink {
  id: string
  projectId: string
  label: string
  url: string
}

export interface MonitoringLinkInput {
  projectId: string
  label: string
  url: string
}

export type PostLaunchIssueSeverity = 'low' | 'medium' | 'high' | 'critical'
export type PostLaunchIssueStatus = 'open' | 'in_progress' | 'resolved'

export interface PostLaunchIssue {
  id: string
  projectId: string
  title: string
  severity: PostLaunchIssueSeverity
  status: PostLaunchIssueStatus
  reportedAt: Timestamp
}

export interface PostLaunchIssueInput {
  projectId: string
  title: string
  severity: PostLaunchIssueSeverity
  status: PostLaunchIssueStatus
}

// ===== Sikagit Integration =====

/** A sikagit project as returned by our `/api/sikagit/projects` endpoint. */
export interface SikagitProject {
  id: string
  name: string
  avatar?: string | null
  position: number
  createdAt: string
  repoIds: string[]
}

/** A sikagit repo as returned by `/api/sikagit/projects/:id/repos`. */
export interface SikagitRepo {
  id: string
  name: string
  /** Original sikagit-stored path (Docker-container view, may start with /host). */
  path: string
  /** Host-friendly display path. */
  displayPath: string
  /** Real on-host filesystem path, with /host prefix stripped. */
  hostPath: string
  isWSL: boolean
  group?: string | null
  avatar?: string | null
  lastOpened?: string | null
  /** Names of the sikagit projects this repo belongs to (populated by the list-all endpoint). */
  projectNames?: string[]
}

// ===== Project Stage: Repos (graph stored in Firestore) =====

export interface RepoGraphNode {
  /** sikagit repo id. */
  repoId: string
  x: number
  y: number
}

export interface RepoGraphEdge {
  id: string
  sourceRepoId: string
  targetRepoId: string
  label?: string | null
}

export interface ProjectRepoGraph {
  projectId: string
  nodes: RepoGraphNode[]
  edges: RepoGraphEdge[]
  updatedAt: Timestamp
}

/** AI-generated short summary of a repo's README, cached per project+repo. */
export interface RepoSummary {
  id: string
  projectId: string
  repoId: string
  summary: string
  /** Stored README text (synced from sikagit), so prod can render it without filesystem access. */
  readme?: string | null
  generatedAt: Timestamp
}

/** A single repo captured in a Firestore snapshot (sikagit → Firestore). */
export interface RepoSnapshot {
  id: string
  name: string
  displayPath: string
  group?: string | null
  avatar?: string | null
  lastOpened?: string | null
}

/** The persisted snapshot of a project's repos, written by a local "Sync from sikagit" action. */
export interface ProjectRepos {
  projectId: string
  repos: RepoSnapshot[]
  syncedAt: Timestamp
  syncedBy: string
}

// ===== Project Stage: Deploy (infrastructure) =====

export interface ProjectDeploy {
  projectId: string
  /** Free text — architecture, hosting layout, networks, backups. */
  infrastructureNotes: string
  /** Free text — hardening, firewall, TLS, auth, headers, secrets. */
  securityNotes: string
  /** Tech tags: e.g. 'Docker Compose', 'Caddy 2', 'Postgres 17'. */
  technologies: string[]
  updatedAt: Timestamp
}

export type DeployServerStatus = 'planned' | 'provisioning' | 'live' | 'retired'

export interface DeployServer {
  id: string
  projectId: string
  name: string
  provider: string
  region?: string | null
  specs?: string | null
  ip?: string | null
  os?: string | null
  costMonthly?: string | null
  status: DeployServerStatus
  notes?: string | null
}

export interface DeployServerInput {
  projectId: string
  name: string
  provider: string
  region?: string | null
  specs?: string | null
  ip?: string | null
  os?: string | null
  costMonthly?: string | null
  status: DeployServerStatus
  notes?: string | null
}

export type DeployRecSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type DeployRecArea = 'security' | 'infrastructure' | 'optimization'
export type DeployRecStatus = 'open' | 'resolved' | 'dismissed'

/** A security / infrastructure recommendation surfaced on the Deploy stage. */
export interface DeployRecommendation {
  id: string
  projectId: string
  severity: DeployRecSeverity
  area: DeployRecArea
  title: string
  detail: string
  status: DeployRecStatus
  createdAt: Timestamp
}

export interface DeployRecommendationInput {
  projectId: string
  severity: DeployRecSeverity
  area: DeployRecArea
  title: string
  detail: string
  status?: DeployRecStatus
}

export type DeployDomainSsl = 'lets_encrypt' | 'cloudflare' | 'custom' | 'none'

export interface DeployDomain {
  id: string
  projectId: string
  domain: string
  /** What the domain serves / points at, e.g. 'portal Next.js :3000'. */
  target: string
  dnsProvider?: string | null
  ssl: DeployDomainSsl
  proxied?: boolean
  notes?: string | null
}

export interface DeployDomainInput {
  projectId: string
  domain: string
  target: string
  dnsProvider?: string | null
  ssl: DeployDomainSsl
  proxied?: boolean
  notes?: string | null
}

// ===== Social Media =====

export type SocialPlatform = 'fb' | 'ig' | 'li'
export type SocialPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type SocialMediaType = 'none' | 'image' | 'video'

export interface SocialPost {
  id: string
  projectId: string
  platforms: SocialPlatform[]
  caption: string
  mediaUrls: string[]
  mediaType: SocialMediaType
  status: SocialPostStatus
  scheduledAt: Timestamp | null
  publishedAt: Timestamp | null
  fbPostId: string | null
  igMediaId: string | null
  liPostId: string | null
  error: string | null
  attempts: number
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type SocialPostInput = Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>

export type InsightScope = 'account' | 'post'

export interface SocialInsight {
  id: string
  scope: InsightScope
  refId: string
  platform: SocialPlatform
  metrics: Record<string, number>
  capturedAt: Timestamp
}

export type AdCampaignStatus = 'draft' | 'active' | 'paused' | 'completed'

export interface AdCampaign {
  id: string
  projectId: string
  metaCampaignId: string | null
  name: string
  objective: string
  status: AdCampaignStatus
  dailyBudget: number | null
  adSetIds: string[]
  adIds: string[]
  lastMetrics: Record<string, number> | null
  lastSyncedAt: Timestamp | null
  createdBy: string
  createdAt: Timestamp
}
