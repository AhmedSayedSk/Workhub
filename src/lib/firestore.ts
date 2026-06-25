import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  setDoc,
  Timestamp,
  QueryConstraint,
  DocumentData,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Organization,
  OrganizationInput,
  Project,
  ProjectInput,
  ProjectDistribution,
  Milestone,
  MilestoneInput,
  Feature,
  FeatureInput,
  Task,
  TaskInput,
  Subtask,
  SubtaskInput,
  TimeEntry,
  TimeEntryInput,
  MonthlyPayment,
  MonthlyPaymentInput,
  AISuggestion,
  AppSettings,
  AppSettingsInput,
  MediaFile,
  MediaFileInput,
  MediaFolder,
  MediaFolderInput,
  VaultEntry,
  VaultEntryInput,
  TaskComment,
  TaskCommentInput,
  TaskQuestion,
  TaskQuestionInput,
  CommentParentType,
  ProjectLog,
  ProjectLogAction,
  ProjectLogChange,
  Member,
  MemberInput,
  ProjectNote,
  ProjectNoteInput,
  CalendarEvent,
  CalendarEventInput,
  ImageGeneration,
  ImageGenSession,
  ImageAsset,
  ImageAssetFolder,
  ImageAssetFolderInput,
  ImageGenLog,
  UserProfile,
  MemberPermission,
  ProjectPermissions,
  ModulePermissions,
  AuditLog,
  AuditLogInput,
  AuditLogType,
  ProjectStage,
  ProjectShape,
  Decision,
  DecisionInput,
  DecisionStatus,
  ProjectMarket,
  MarketChannel,
  MarketChannelInput,
  MarketChannelStatus,
  LaunchAsset,
  LaunchAssetInput,
  LaunchAssetStatus,
  ProjectLaunch,
  LaunchStatus,
  LaunchChecklistItem,
  LaunchChecklistItemInput,
  LaunchChecklistStatus,
  MonitoringLink,
  MonitoringLinkInput,
  PostLaunchIssue,
  PostLaunchIssueInput,
  PostLaunchIssueStatus,
  ProjectRepoGraph,
  RepoSummary,
  ProjectRepos,
  RepoSnapshot,
  ProjectDeploy,
  DeployServer,
  DeployServerInput,
  DeployDomain,
  DeployDomainInput,
  DeployRecommendation,
  DeployRecommendationInput,
  DeployRecStatus,
  MarketPlaybookItem,
  MarketPlaybookItemInput,
  MarketPlaybookStatus,
  MarketCampaign,
  MarketCampaignInput,
  MarketCampaignStatus,
  MarketListing,
  MarketListingInput,
  MarketListingStatus,
  ProjectDesign,
  DesignPrototype,
  DesignPrototypeInput,
  DesignScreen,
  DesignScreenInput,
  DesignScreenStatus,
  DesignImage,
  DesignImageInput,
  NextStep,
  NextStepInput,
  NextStepStatus,
  SocialPost,
  SocialPostInput,
  SocialPostStatus,
  SocialInsight,
  InsightScope,
} from '@/types'

// Helper function to convert input dates to Timestamps
function toTimestamp(date: Date | null): Timestamp | null {
  return date ? Timestamp.fromDate(date) : null
}

// Generic CRUD helpers
async function getAll<T extends { id: string }>(
  collectionName: string,
  ...constraints: QueryConstraint[]
): Promise<T[]> {
  const q = query(collection(db, collectionName), ...constraints)
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

async function getById<T extends { id: string }>(
  collectionName: string,
  id: string
): Promise<T | null> {
  const docRef = doc(db, collectionName, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) return null

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as T
}

async function create<T extends DocumentData>(
  collectionName: string,
  data: T
): Promise<string> {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now(),
  })
  return docRef.id
}

async function update<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: Partial<T>
): Promise<void> {
  const docRef = doc(db, collectionName, id)
  // Strip undefined values - Firebase doesn't accept them
  const cleanData = Object.fromEntries(
    Object.entries(data as DocumentData).filter(([, v]) => v !== undefined)
  )
  await updateDoc(docRef, cleanData)
}

async function remove(collectionName: string, id: string): Promise<void> {
  const docRef = doc(db, collectionName, id)
  await deleteDoc(docRef)
}

// User Profiles (for sharing lookups)
export const userProfiles = {
  async upsert(user: { uid: string; email: string | null; displayName: string | null; photoURL: string | null }): Promise<void> {
    if (!user.email) return
    const docRef = doc(db, 'userProfiles', user.uid)
    const { setDoc } = await import('firebase/firestore')
    await setDoc(docRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLoginAt: Timestamp.now(),
    }, { merge: true })
  },

  async findByEmail(email: string): Promise<UserProfile | null> {
    const results = await getAll<UserProfile>('userProfiles', where('email', '==', email))
    return results[0] || null
  },

  async getByUids(uids: string[]): Promise<UserProfile[]> {
    if (uids.length === 0) return []
    const results: UserProfile[] = []
    for (const uid of uids) {
      const profile = await getById<UserProfile>('userProfiles', uid)
      if (profile) results.push(profile)
    }
    return results
  },
}

// Organizations
export const organizations = {
  async getAll(): Promise<Organization[]> {
    return getAll<Organization>('organizations', orderBy('createdAt', 'desc'))
  },

  async getById(id: string): Promise<Organization | null> {
    return getById<Organization>('organizations', id)
  },

  async create(data: OrganizationInput): Promise<string> {
    return create('organizations', data)
  },

  async update(id: string, data: Partial<OrganizationInput>): Promise<void> {
    return update('organizations', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('organizations', id)
  },
}

// Projects
export const projects = {
  async getAll(userId?: string): Promise<Project[]> {
    if (!userId) return []
    // Fetch projects the user owns + projects shared with them, then merge
    const [owned, shared] = await Promise.all([
      getAll<Project>('projects', where('ownerId', '==', userId)),
      getAll<Project>('projects', where('sharedWith', 'array-contains', userId)),
    ])
    const merged = new Map<string, Project>()
    for (const p of [...owned, ...shared]) merged.set(p.id, p)
    return [...merged.values()].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async getById(id: string): Promise<Project | null> {
    return getById<Project>('projects', id)
  },

  async getSubProjects(parentProjectId: string, userId?: string): Promise<Project[]> {
    if (!userId) return []
    // Get all accessible projects, then filter for sub-projects of the given parent
    const all = await this.getAll(userId)
    return all
      .filter((p) => p.parentProjectId === parentProjectId)
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async create(data: ProjectInput & { ownerId: string }): Promise<string> {
    return create('projects', {
      ...data,
      parentProjectId: data.parentProjectId ?? null,
      hasOwnFinances: data.hasOwnFinances ?? true,
      enabledStages: data.enabledStages ?? ['build'],
      lastTouchedStage: null,
      startDate: Timestamp.fromDate(data.startDate),
      deadline: toTimestamp(data.deadline),
      warrantyStartDate: toTimestamp(data.warrantyStartDate ?? null),
      ownerId: data.ownerId,
      sharedWith: data.sharedWith ?? [],
      pendingSharedEmails: data.pendingSharedEmails ?? [],
    })
  },

  async update(id: string, data: Partial<ProjectInput>): Promise<void> {
    const updateData: DocumentData = { ...data }
    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate)
    }
    if (data.deadline !== undefined) {
      updateData.deadline = toTimestamp(data.deadline)
    }
    if (data.warrantyStartDate !== undefined) {
      updateData.warrantyStartDate = toTimestamp(data.warrantyStartDate)
    }
    return update('projects', id, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('projects', id)
  },

  /** Resolve pending invites for a user who just logged in */
  async resolvePendingInvites(uid: string, email: string): Promise<void> {
    const emailLower = email.toLowerCase()
    const pending = await getAll<Project>('projects', where('pendingSharedEmails', 'array-contains', emailLower))
    for (const project of pending) {
      const newSharedWith = project.sharedWith?.includes(uid)
        ? project.sharedWith
        : [...(project.sharedWith || []), uid]
      const newPending = (project.pendingSharedEmails || []).filter((e) => e.toLowerCase() !== emailLower)
      await update('projects', project.id, { sharedWith: newSharedWith, pendingSharedEmails: newPending })
    }
  },

  /** Update sharedWith on a project and all its sub-projects */
  async updateSharing(projectId: string, sharedWith: string[], ownerId: string): Promise<void> {
    await update('projects', projectId, { sharedWith })
    // Propagate to sub-projects
    const subs = await getAll<Project>('projects', where('parentProjectId', '==', projectId), where('ownerId', '==', ownerId))
    for (const sub of subs) {
      await this.updateSharing(sub.id, sharedWith, ownerId)
    }
  },

  /** Replace the project's equity distribution (categories + partners). */
  async updateDistribution(projectId: string, distribution: ProjectDistribution): Promise<void> {
    return update('projects', projectId, { distribution })
  },

  async getByStatus(status: string, userId?: string): Promise<Project[]> {
    if (!userId) return []
    const all = await this.getAll(userId)
    return all.filter((p) => p.status === status)
  },

  async enableStage(projectId: string, stage: ProjectStage): Promise<void> {
    await update('projects', projectId, { enabledStages: arrayUnion(stage) })
  },

  async disableStage(projectId: string, stage: ProjectStage): Promise<void> {
    await update('projects', projectId, { enabledStages: arrayRemove(stage) })
  },

  /**
   * Mark a stage as the most recently touched. Call from every stage-content
   * mutating write (create/update/delete). Enable/disable do NOT touch.
   */
  async touchStage(projectId: string, stage: ProjectStage): Promise<void> {
    await update('projects', projectId, {
      lastTouchedStage: stage,
      lastTouchedAt: Timestamp.now(),
    })
  },
}

// Milestones
export const milestones = {
  async getAll(projectId?: string): Promise<Milestone[]> {
    const constraints: QueryConstraint[] = [orderBy('dueDate', 'asc')]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<Milestone>('milestones', ...constraints)
  },

  async getById(id: string): Promise<Milestone | null> {
    return getById<Milestone>('milestones', id)
  },

  async create(data: MilestoneInput): Promise<string> {
    return create('milestones', {
      ...data,
      dueDate: Timestamp.fromDate(data.dueDate),
      completedAt: toTimestamp(data.completedAt),
      paidAt: toTimestamp(data.paidAt),
    })
  },

  async update(id: string, data: Partial<MilestoneInput>): Promise<void> {
    const updateData: DocumentData = { ...data }
    if (data.dueDate) {
      updateData.dueDate = Timestamp.fromDate(data.dueDate)
    }
    if (data.completedAt !== undefined) {
      updateData.completedAt = toTimestamp(data.completedAt)
    }
    if (data.paidAt !== undefined) {
      updateData.paidAt = toTimestamp(data.paidAt)
    }
    return update('milestones', id, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('milestones', id)
  },
}

// Features
export const features = {
  async getAll(projectId?: string): Promise<Feature[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<Feature>('features', ...constraints)
  },

  async getById(id: string): Promise<Feature | null> {
    return getById<Feature>('features', id)
  },

  async create(data: FeatureInput): Promise<string> {
    return create('features', data)
  },

  async update(id: string, data: Partial<FeatureInput>): Promise<void> {
    return update('features', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('features', id)
  },
}

// Tasks
export const tasks = {
  async getAll(featureId?: string, projectId?: string): Promise<Task[]> {
    // Use createdAt DESC to match existing Firestore indexes
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (featureId) {
      constraints.unshift(where('featureId', '==', featureId))
    } else if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    const allTasks = await getAll<Task>('tasks', ...constraints)
    // Sort by sortOrder with fallback to createdAt for legacy tasks
    return allTasks.sort((a, b) => {
      const orderA = a.sortOrder ?? a.createdAt?.toMillis() ?? 0
      const orderB = b.sortOrder ?? b.createdAt?.toMillis() ?? 0
      return orderA - orderB
    })
  },

  async getById(id: string): Promise<Task | null> {
    return getById<Task>('tasks', id)
  },

  async create(data: TaskInput): Promise<string> {
    // Calculate sortOrder for new task - add to end of column
    const sortOrder = data.sortOrder ?? Date.now()
    const taskType = data.taskType ?? 'task'
    return create('tasks', { ...data, actualHours: 0, sortOrder, taskType })
  },

  async update(id: string, data: Partial<TaskInput>): Promise<void> {
    const updates: Record<string, unknown> = { ...data }
    if (data.status === 'done') {
      updates.doneAt = updates.doneAt ?? Timestamp.now()
    } else if (data.status) {
      updates.doneAt = null
    }
    return update('tasks', id, updates)
  },

  async delete(id: string): Promise<void> {
    return remove('tasks', id)
  },

  async getByStatus(status: string, projectId?: string): Promise<Task[]> {
    // Use createdAt DESC to match existing Firestore indexes
    const constraints: QueryConstraint[] = [
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
    ]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    const allTasks = await getAll<Task>('tasks', ...constraints)
    // Sort by sortOrder with fallback to createdAt for legacy tasks
    return allTasks.sort((a, b) => {
      const orderA = a.sortOrder ?? a.createdAt?.toMillis() ?? 0
      const orderB = b.sortOrder ?? b.createdAt?.toMillis() ?? 0
      return orderA - orderB
    })
  },

  async reorder(taskId: string, newStatus: string, newSortOrder: number): Promise<void> {
    const updates: Record<string, unknown> = { status: newStatus, sortOrder: newSortOrder }
    if (newStatus === 'done') {
      updates.doneAt = Timestamp.now()
    } else {
      updates.doneAt = null
    }
    return update('tasks', taskId, updates)
  },

  // Move a task to another project. Cascades the projectId update to denormalised
  // copies on TaskQuestions and TimeEntries so finance/time reports stay accurate.
  // featureId is reset to '' by default since features are project-scoped; pass a
  // targetFeatureId to land the task in a specific feature in the new project.
  // sortOrder is recomputed as "end of column" in the target project's status.
  async move(
    taskId: string,
    target: { projectId: string; projectName: string; featureId?: string },
  ): Promise<void> {
    const task = await getById<Task>('tasks', taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)
    if (task.projectId === target.projectId) return // no-op

    // Compute end-of-column sortOrder in the target project for the task's status.
    const targetTasks = await getAll<Task>(
      'tasks',
      where('projectId', '==', target.projectId),
      where('status', '==', task.status),
    )
    const maxOrder = targetTasks.reduce((m, t) => {
      const o = t.sortOrder ?? t.createdAt?.toMillis?.() ?? 0
      return o > m ? o : m
    }, 0)
    const newSortOrder = maxOrder + 1000

    // Read related denormalised collections before opening the batch.
    const [relatedQuestions, relatedTimeEntries] = await Promise.all([
      getAll<TaskQuestion>('taskQuestions', where('taskId', '==', taskId)),
      getAll<TimeEntry>('timeEntries', where('taskId', '==', taskId)),
    ])

    const batchOp = writeBatch(db)
    batchOp.update(doc(db, 'tasks', taskId), {
      projectId: target.projectId,
      featureId: target.featureId ?? '',
      sortOrder: newSortOrder,
    })
    for (const q of relatedQuestions) {
      batchOp.update(doc(db, 'taskQuestions', q.id), {
        projectId: target.projectId,
        projectName: target.projectName,
      })
    }
    for (const t of relatedTimeEntries) {
      batchOp.update(doc(db, 'timeEntries', t.id), {
        projectId: target.projectId,
      })
    }
    await batchOp.commit()
  },
}

// Subtasks
export const subtasks = {
  async getAll(taskId?: string): Promise<Subtask[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'asc')]
    if (taskId) {
      constraints.unshift(where('taskId', '==', taskId))
    }
    return getAll<Subtask>('subtasks', ...constraints)
  },

  async getByTaskIds(taskIds: string[]): Promise<Subtask[]> {
    if (taskIds.length === 0) return []

    // Firestore 'in' query is limited to 30 items, so we batch the queries
    const results: Subtask[] = []
    const batchSize = 30

    for (let i = 0; i < taskIds.length; i += batchSize) {
      const batch = taskIds.slice(i, i + batchSize)
      const batchResults = await getAll<Subtask>(
        'subtasks',
        where('taskId', 'in', batch),
        orderBy('createdAt', 'asc')
      )
      results.push(...batchResults)
    }

    return results
  },

  async getById(id: string): Promise<Subtask | null> {
    return getById<Subtask>('subtasks', id)
  },

  async create(data: SubtaskInput): Promise<string> {
    return create('subtasks', data)
  },

  async update(id: string, data: Partial<SubtaskInput>): Promise<void> {
    return update('subtasks', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('subtasks', id)
  },
}

// Task Comments
export const taskComments = {
  async getByParent(parentId: string, parentType: CommentParentType): Promise<TaskComment[]> {
    const comments = await getAll<TaskComment>(
      'taskComments',
      where('parentId', '==', parentId),
      where('parentType', '==', parentType),
      orderBy('createdAt', 'asc')
    )
    // Newest first
    return comments.reverse()
  },

  async create(data: TaskCommentInput): Promise<string> {
    return create('taskComments', data)
  },

  async delete(id: string): Promise<void> {
    return remove('taskComments', id)
  },

  async getByParentIds(parentIds: string[], parentType: CommentParentType): Promise<TaskComment[]> {
    if (parentIds.length === 0) return []

    const results: TaskComment[] = []
    const batchSize = 30

    for (let i = 0; i < parentIds.length; i += batchSize) {
      const batch = parentIds.slice(i, i + batchSize)
      const batchResults = await getAll<TaskComment>(
        'taskComments',
        where('parentId', 'in', batch),
        where('parentType', '==', parentType)
      )
      results.push(...batchResults)
    }

    return results
  },

  async deleteByParent(parentId: string, parentType: CommentParentType): Promise<void> {
    const comments = await this.getByParent(parentId, parentType)
    for (const comment of comments) {
      await remove('taskComments', comment.id)
    }
  },
}

// Task Questions — questions Claude asks on a task; the owner answers via UI
export const taskQuestions = {
  async getByTaskId(taskId: string): Promise<TaskQuestion[]> {
    const all = await getAll<TaskQuestion>('taskQuestions', where('taskId', '==', taskId))
    return all.sort((a, b) => (a.askedAt?.toMillis() ?? 0) - (b.askedAt?.toMillis() ?? 0))
  },

  async getAllUnanswered(): Promise<TaskQuestion[]> {
    const all = await getAll<TaskQuestion>('taskQuestions', where('answer', '==', null))
    return all.sort((a, b) => (a.askedAt?.toMillis() ?? 0) - (b.askedAt?.toMillis() ?? 0))
  },

  async create(input: TaskQuestionInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'taskQuestions'), {
      taskId: input.taskId,
      taskName: input.taskName,
      projectId: input.projectId,
      projectName: input.projectName,
      question: input.question,
      askedBy: input.askedBy,
      askedAt: Timestamp.now(),
      answer: null,
      answeredAt: null,
      answeredBy: null,
    })
    return docRef.id
  },

  async answer(id: string, answer: string, answeredBy: string): Promise<void> {
    return update('taskQuestions', id, {
      answer,
      answeredBy,
      answeredAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('taskQuestions', id)
  },
}

// Time Entries
export const timeEntries = {
  async getAll(projectId?: string, taskId?: string): Promise<TimeEntry[]> {
    const constraints: QueryConstraint[] = [orderBy('startTime', 'desc')]
    if (taskId) {
      constraints.unshift(where('taskId', '==', taskId))
    } else if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<TimeEntry>('timeEntries', ...constraints)
  },

  async getById(id: string): Promise<TimeEntry | null> {
    return getById<TimeEntry>('timeEntries', id)
  },

  async create(data: TimeEntryInput): Promise<string> {
    return create('timeEntries', {
      ...data,
      startTime: Timestamp.fromDate(data.startTime),
      endTime: toTimestamp(data.endTime),
    })
  },

  async update(id: string, data: Partial<TimeEntryInput>): Promise<void> {
    const updateData: DocumentData = { ...data }
    if (data.startTime) {
      updateData.startTime = Timestamp.fromDate(data.startTime)
    }
    if (data.endTime !== undefined) {
      updateData.endTime = toTimestamp(data.endTime)
    }
    return update('timeEntries', id, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('timeEntries', id)
  },

  async getActive(): Promise<TimeEntry | null> {
    const entries = await getAll<TimeEntry>(
      'timeEntries',
      where('endTime', '==', null),
      orderBy('startTime', 'desc')
    )
    return entries[0] || null
  },

  async getByDateRange(startDate: Date, endDate: Date, projectId?: string): Promise<TimeEntry[]> {
    const constraints: QueryConstraint[] = [
      where('startTime', '>=', Timestamp.fromDate(startDate)),
      where('startTime', '<=', Timestamp.fromDate(endDate)),
      orderBy('startTime', 'desc'),
    ]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<TimeEntry>('timeEntries', ...constraints)
  },
}

// Monthly Payments
export const monthlyPayments = {
  async getAll(projectId?: string): Promise<MonthlyPayment[]> {
    const constraints: QueryConstraint[] = [orderBy('month', 'desc')]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<MonthlyPayment>('monthlyPayments', ...constraints)
  },

  async getById(id: string): Promise<MonthlyPayment | null> {
    return getById<MonthlyPayment>('monthlyPayments', id)
  },

  async create(data: MonthlyPaymentInput): Promise<string> {
    return create('monthlyPayments', {
      ...data,
      paidAt: toTimestamp(data.paidAt),
    })
  },

  async update(id: string, data: Partial<MonthlyPaymentInput>): Promise<void> {
    const updateData: DocumentData = { ...data }
    if (data.paidAt !== undefined) {
      updateData.paidAt = toTimestamp(data.paidAt)
    }
    return update('monthlyPayments', id, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('monthlyPayments', id)
  },
}

// AI Suggestions
export const aiSuggestions = {
  async getAll(entityId?: string): Promise<AISuggestion[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (entityId) {
      constraints.unshift(where('entityId', '==', entityId))
    }
    return getAll<AISuggestion>('aiSuggestions', ...constraints)
  },

  async create(data: Omit<AISuggestion, 'id' | 'createdAt'>): Promise<string> {
    return create('aiSuggestions', data)
  },

  async markAccepted(id: string): Promise<void> {
    return update('aiSuggestions', id, { accepted: true })
  },
}

// App Settings (singleton document)
const SETTINGS_DOC_ID = 'app_settings'

export const appSettings = {
  async get(): Promise<AppSettings | null> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      // Return default settings if not exists
      return null
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as AppSettings
  },

  async getOrCreate(): Promise<AppSettings> {
    const existing = await this.get()
    if (existing) return existing

    // Create default settings
    const defaultSettings: AppSettingsInput = {
      aiModel: 'gemini-3-flash-preview',
      aiEnabled: true,
      thinkingTimePercent: 0,
      notifyTimerReminder: true,
      timerReminderMinutes: 120,
      notifyDeadlineAlerts: true,
      deadlineAlertDays: 3,
      notifyPaymentReminders: true,
      notifyDailySummary: false,
      dailySummaryHour: 18,
      notifyIdleReminder: true,
      idleReminderMinutes: 30,
      notifyTaskDue: true,
      taskDueHoursBefore: 24,
      notifyBreakReminder: false,
      breakReminderMinutes: 90,
    }

    const docRef = doc(db, 'settings', SETTINGS_DOC_ID)
    await updateDoc(docRef, {
      ...defaultSettings,
      updatedAt: Timestamp.now(),
    }).catch(async () => {
      // Document doesn't exist, create it using setDoc
      const { setDoc } = await import('firebase/firestore')
      await setDoc(docRef, {
        ...defaultSettings,
        updatedAt: Timestamp.now(),
      })
    })

    return {
      id: SETTINGS_DOC_ID,
      ...defaultSettings,
      updatedAt: Timestamp.now(),
    } as AppSettings
  },

  async update(data: Partial<AppSettingsInput>): Promise<void> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID)
    try {
      await updateDoc(docRef, {
        ...data,
        updatedAt: Timestamp.now(),
      })
    } catch {
      // Document doesn't exist, create it
      const { setDoc } = await import('firebase/firestore')
      await setDoc(docRef, {
        aiModel: 'gemini-3-flash-preview',
        aiEnabled: true,
        thinkingTimePercent: 0,
        ...data,
        updatedAt: Timestamp.now(),
      })
    }
  },
}

// Members
export const members = {
  async getAll(): Promise<Member[]> {
    return getAll<Member>('members', orderBy('createdAt', 'desc'))
  },

  async getById(id: string): Promise<Member | null> {
    return getById<Member>('members', id)
  },

  async getByIds(ids: string[]): Promise<Member[]> {
    if (ids.length === 0) return []

    const results: Member[] = []
    const batchSize = 30

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize)
      const batchResults = await getAll<Member>(
        'members',
        where('__name__', 'in', batch)
      )
      results.push(...batchResults)
    }

    return results
  },

  async create(data: MemberInput): Promise<string> {
    return create('members', data)
  },

  async update(id: string, data: Partial<MemberInput>): Promise<void> {
    return update('members', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('members', id)
  },
}

// Batch operations
export const batch = {
  async deleteProjectCascade(projectId: string, userId?: string): Promise<void> {
    // Recursively delete sub-projects first
    const subProjects = await projects.getSubProjects(projectId, userId)
    for (const sub of subProjects) {
      await this.deleteProjectCascade(sub.id, userId)
    }

    const batchOp = writeBatch(db)

    // Get all related documents
    const [
      projectMilestones,
      projectFeatures,
      projectTasks,
      projectTimeEntries,
      projectPayments,
    ] = await Promise.all([
      milestones.getAll(projectId),
      features.getAll(projectId),
      tasks.getAll(undefined, projectId),
      timeEntries.getAll(projectId),
      monthlyPayments.getAll(projectId),
    ])

    // Delete project logs
    await projectLogs.deleteByProject(projectId)

    // Get subtasks for all tasks
    const taskIds = projectTasks.map((t) => t.id)
    const allSubtasks: Subtask[] = []
    for (const taskId of taskIds) {
      const taskSubtasks = await subtasks.getAll(taskId)
      allSubtasks.push(...taskSubtasks)
    }

    // Delete comments for all tasks and subtasks
    for (const t of projectTasks) {
      await taskComments.deleteByParent(t.id, 'task')
    }
    for (const s of allSubtasks) {
      await taskComments.deleteByParent(s.id, 'subtask')
    }

    // Delete all related documents
    projectMilestones.forEach((m) => batchOp.delete(doc(db, 'milestones', m.id)))
    projectFeatures.forEach((f) => batchOp.delete(doc(db, 'features', f.id)))
    projectTasks.forEach((t) => batchOp.delete(doc(db, 'tasks', t.id)))
    allSubtasks.forEach((s) => batchOp.delete(doc(db, 'subtasks', s.id)))
    projectTimeEntries.forEach((te) => batchOp.delete(doc(db, 'timeEntries', te.id)))
    projectPayments.forEach((p) => batchOp.delete(doc(db, 'monthlyPayments', p.id)))

    // Delete the project itself
    batchOp.delete(doc(db, 'projects', projectId))

    await batchOp.commit()
  },

}

// Media Folders
export const mediaFolders = {
  async getAll(userId: string, parentId?: string | null): Promise<MediaFolder[]> {
    // Simple query without composite index - just filter by user
    const allFolders = await getAll<MediaFolder>(
      'mediaFolders',
      where('createdBy', '==', userId)
    )

    // Filter by parentId client-side and sort by name
    let result = allFolders
    if (parentId !== undefined) {
      result = allFolders.filter(f => f.parentId === parentId)
    }

    return result.sort((a, b) => a.name.localeCompare(b.name))
  },

  async getById(id: string): Promise<MediaFolder | null> {
    return getById<MediaFolder>('mediaFolders', id)
  },

  async create(data: MediaFolderInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'mediaFolders'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  async update(id: string, data: Partial<MediaFolderInput>): Promise<void> {
    const docRef = doc(db, 'mediaFolders', id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('mediaFolders', id)
  },

  async getPath(folderId: string | null): Promise<MediaFolder[]> {
    const path: MediaFolder[] = []
    let currentId = folderId

    while (currentId) {
      const folder = await this.getById(currentId)
      if (!folder) break
      path.unshift(folder)
      currentId = folder.parentId
    }

    return path
  },

  async getChildren(userId: string, parentId: string | null): Promise<MediaFolder[]> {
    return this.getAll(userId, parentId)
  },
}

// Media Files
export const mediaFiles = {
  async getAll(userId: string, folderId?: string | null): Promise<MediaFile[]> {
    // Simple query without composite index - just filter by user
    const allFiles = await getAll<MediaFile>(
      'mediaFiles',
      where('uploadedBy', '==', userId)
    )

    // Filter by folderId client-side and sort by date
    let result = allFiles
    if (folderId !== undefined) {
      result = allFiles.filter(f => f.folderId === folderId)
    }

    return result.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async getById(id: string): Promise<MediaFile | null> {
    return getById<MediaFile>('mediaFiles', id)
  },

  async create(data: MediaFileInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'mediaFiles'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  async update(id: string, data: Partial<MediaFileInput>): Promise<void> {
    const docRef = doc(db, 'mediaFiles', id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('mediaFiles', id)
  },

  async getByProject(projectId: string): Promise<MediaFile[]> {
    const files = await getAll<MediaFile>(
      'mediaFiles',
      where('linkedProjects', 'array-contains', projectId)
    )
    return files.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async getByTask(taskId: string): Promise<MediaFile[]> {
    const files = await getAll<MediaFile>(
      'mediaFiles',
      where('linkedTasks', 'array-contains', taskId)
    )
    return files.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async linkToProject(fileId: string, projectId: string): Promise<void> {
    const file = await this.getById(fileId)
    if (!file) throw new Error('File not found')

    const linkedProjects = file.linkedProjects.includes(projectId)
      ? file.linkedProjects
      : [...file.linkedProjects, projectId]

    await this.update(fileId, { linkedProjects })
  },

  async unlinkFromProject(fileId: string, projectId: string): Promise<void> {
    const file = await this.getById(fileId)
    if (!file) throw new Error('File not found')

    const linkedProjects = file.linkedProjects.filter((id) => id !== projectId)
    await this.update(fileId, { linkedProjects })
  },

  async linkToTask(fileId: string, taskId: string): Promise<void> {
    const file = await this.getById(fileId)
    if (!file) throw new Error('File not found')

    const linkedTasks = file.linkedTasks.includes(taskId)
      ? file.linkedTasks
      : [...file.linkedTasks, taskId]

    await this.update(fileId, { linkedTasks })
  },

  async unlinkFromTask(fileId: string, taskId: string): Promise<void> {
    const file = await this.getById(fileId)
    if (!file) throw new Error('File not found')

    const linkedTasks = file.linkedTasks.filter((id) => id !== taskId)
    await this.update(fileId, { linkedTasks })
  },

  async moveToFolder(fileId: string, folderId: string | null): Promise<void> {
    await this.update(fileId, { folderId })
  },

  async search(userId: string, searchTerm: string): Promise<MediaFile[]> {
    const allFiles = await this.getAll(userId)
    const lowerSearch = searchTerm.toLowerCase()
    return allFiles.filter(
      (file) =>
        file.name.toLowerCase().includes(lowerSearch) ||
        file.displayName.toLowerCase().includes(lowerSearch)
    )
  },
}

// Media Batch operations
export const mediaBatch = {
  async deleteFolderCascade(folderId: string, userId: string): Promise<string[]> {
    const deletedStoragePaths: string[] = []

    // Get all files in this folder
    const folderFiles = await mediaFiles.getAll(userId, folderId)
    for (const file of folderFiles) {
      deletedStoragePaths.push(file.storagePath)
      await mediaFiles.delete(file.id)
    }

    // Get all subfolders
    const subfolders = await mediaFolders.getChildren(userId, folderId)
    for (const subfolder of subfolders) {
      const subPaths = await this.deleteFolderCascade(subfolder.id, userId)
      deletedStoragePaths.push(...subPaths)
    }

    // Delete the folder itself
    await mediaFolders.delete(folderId)

    return deletedStoragePaths
  },

  async moveFiles(fileIds: string[], targetFolderId: string | null): Promise<void> {
    const batchOp = writeBatch(db)

    for (const fileId of fileIds) {
      const fileRef = doc(db, 'mediaFiles', fileId)
      batchOp.update(fileRef, {
        folderId: targetFolderId,
        updatedAt: Timestamp.now(),
      })
    }

    await batchOp.commit()
  },

  async deleteFiles(fileIds: string[]): Promise<string[]> {
    const deletedStoragePaths: string[] = []

    for (const fileId of fileIds) {
      const file = await mediaFiles.getById(fileId)
      if (file) {
        deletedStoragePaths.push(file.storagePath)
        await mediaFiles.delete(fileId)
      }
    }

    return deletedStoragePaths
  },
}

// Project Activity Logs
export const projectLogs = {
  async getByProject(projectId: string): Promise<ProjectLog[]> {
    // Query by projectId only, sort client-side to avoid needing a composite index
    const logs = await getAll<ProjectLog>(
      'projectLogs',
      where('projectId', '==', projectId)
    )
    return logs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async create(data: {
    projectId: string
    action: ProjectLogAction
    changes: ProjectLogChange[]
  }): Promise<string> {
    return create('projectLogs', data)
  },

  async delete(id: string): Promise<void> {
    await remove('projectLogs', id)
  },

  async deleteByProject(projectId: string): Promise<void> {
    const logs = await getAll<ProjectLog>(
      'projectLogs',
      where('projectId', '==', projectId)
    )
    for (const log of logs) {
      await remove('projectLogs', log.id)
    }
  },
}

// Vault entries - project-specific sensitive data storage
export const vaultEntries = {
  async getByProject(projectId: string): Promise<VaultEntry[]> {
    const entries = await getAll<VaultEntry>(
      'vaultEntries',
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    )
    return entries
  },

  async getById(id: string): Promise<VaultEntry | null> {
    return getById<VaultEntry>('vaultEntries', id)
  },

  async create(data: VaultEntryInput): Promise<string> {
    return create('vaultEntries', {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async update(id: string, data: Partial<VaultEntryInput>): Promise<void> {
    return update('vaultEntries', id, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('vaultEntries', id)
  },

  async deleteByProject(projectId: string): Promise<string[]> {
    const entries = await this.getByProject(projectId)
    const deletedStoragePaths: string[] = []

    for (const entry of entries) {
      if (entry.storagePath) {
        deletedStoragePaths.push(entry.storagePath)
      }
      await this.delete(entry.id)
    }

    return deletedStoragePaths
  },
}

// Project Notes
export const projectNotes = {
  async getByProject(projectId: string): Promise<ProjectNote[]> {
    const notes = await getAll<ProjectNote>(
      'projectNotes',
      where('projectId', '==', projectId)
    )
    // Sort: pinned first, then by updatedAt desc
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updatedAt.toMillis() - a.updatedAt.toMillis()
    })
  },

  async create(data: ProjectNoteInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'projectNotes'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  async update(id: string, data: Partial<ProjectNoteInput>): Promise<void> {
    const docRef = doc(db, 'projectNotes', id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('projectNotes', id)
  },
}

// Calendar Events
export const calendarEvents = {
  async getAll(): Promise<CalendarEvent[]> {
    return getAll<CalendarEvent>('calendarEvents')
  },

  async getById(id: string): Promise<CalendarEvent | null> {
    return getById<CalendarEvent>('calendarEvents', id)
  },

  async create(data: CalendarEventInput): Promise<string> {
    const { projectId, taskId, ...rest } = data
    const docData: Record<string, unknown> = {
      ...rest,
      start: Timestamp.fromDate(data.start),
      end: Timestamp.fromDate(data.end),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }
    if (projectId) docData.projectId = projectId
    if (taskId) docData.taskId = taskId
    const docRef = await addDoc(collection(db, 'calendarEvents'), docData)
    return docRef.id
  },

  async update(id: string, data: Partial<CalendarEventInput>): Promise<void> {
    const updateData: Record<string, unknown> = { updatedAt: Timestamp.now() }
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) updateData[key] = value
    })
    if (data.start) updateData.start = Timestamp.fromDate(data.start)
    if (data.end) updateData.end = Timestamp.fromDate(data.end)
    const docRef = doc(db, 'calendarEvents', id)
    await updateDoc(docRef, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('calendarEvents', id)
  },

  async getUpcoming(fromTime: Date, toTime: Date): Promise<CalendarEvent[]> {
    const from = Timestamp.fromDate(fromTime)
    const to = Timestamp.fromDate(toTime)
    return getAll<CalendarEvent>(
      'calendarEvents',
      where('start', '>=', from),
      where('start', '<=', to)
    )
  },
}

// Image Generations
export const imageGenerations = {
  async getAll(userId: string): Promise<ImageGeneration[]> {
    const results = await getAll<ImageGeneration>(
      'imageGenerations',
      where('userId', '==', userId)
    )
    return results.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async create(data: Omit<ImageGeneration, 'id' | 'createdAt'>): Promise<string> {
    return create('imageGenerations', data)
  },

  async update(id: string, data: Partial<ImageGeneration>): Promise<void> {
    return update('imageGenerations', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('imageGenerations', id)
  },
}

// Image Generation Sessions (threads, each with its own standing prompt)
export const imageGenSessions = {
  async getAll(userId: string): Promise<ImageGenSession[]> {
    const results = await getAll<ImageGenSession>(
      'imageGenSessions',
      where('userId', '==', userId)
    )
    // Sort client-side (most-recently-used first) to avoid a composite index.
    return results.sort((a, b) => {
      const am = (a.lastUsedAt || a.createdAt)?.toMillis?.() || 0
      const bm = (b.lastUsedAt || b.createdAt)?.toMillis?.() || 0
      return bm - am
    })
  },

  async create(data: Omit<ImageGenSession, 'id' | 'createdAt'>): Promise<string> {
    return create('imageGenSessions', data)
  },

  async update(id: string, data: Partial<ImageGenSession>): Promise<void> {
    return update('imageGenSessions', id, { ...data, updatedAt: Timestamp.now() })
  },

  async touch(id: string): Promise<void> {
    return update('imageGenSessions', id, { lastUsedAt: Timestamp.now() })
  },

  async delete(id: string): Promise<void> {
    return remove('imageGenSessions', id)
  },
}

// Image Assets (uploaded reference images)
export const imageAssets = {
  async getAll(userId: string, folderId?: string | null): Promise<ImageAsset[]> {
    const results = await getAll<ImageAsset>(
      'imageAssets',
      where('userId', '==', userId)
    )
    // Client-side folder filtering: undefined = all, null = root only, string = specific folder
    let filtered = results
    if (folderId !== undefined) {
      filtered = results.filter(a => (a.folderId ?? null) === folderId)
    }
    return filtered.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async create(data: Omit<ImageAsset, 'id' | 'createdAt'>): Promise<string> {
    return create('imageAssets', { ...data, folderId: data.folderId ?? null })
  },

  async delete(id: string): Promise<void> {
    return remove('imageAssets', id)
  },
}

// Image Asset Folders
export const imageAssetFolders = {
  async getAll(userId: string): Promise<ImageAssetFolder[]> {
    const results = await getAll<ImageAssetFolder>(
      'imageAssetFolders',
      where('userId', '==', userId)
    )
    return results.sort((a, b) => a.name.localeCompare(b.name))
  },

  async create(data: ImageAssetFolderInput): Promise<string> {
    const docRef = await addDoc(collection(db, 'imageAssetFolders'), {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  },

  async update(id: string, data: Partial<ImageAssetFolderInput>): Promise<void> {
    const docRef = doc(db, 'imageAssetFolders', id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  async delete(id: string): Promise<void> {
    return remove('imageAssetFolders', id)
  },

  async deleteCascade(id: string, userId: string): Promise<string[]> {
    const deletedPaths: string[] = []
    const folderAssets = await imageAssets.getAll(userId, id)
    for (const asset of folderAssets) {
      if (asset.storagePath) deletedPaths.push(asset.storagePath)
      if (asset.fullStoragePath) deletedPaths.push(asset.fullStoragePath)
      await imageAssets.delete(asset.id)
    }
    await remove('imageAssetFolders', id)
    return deletedPaths
  },
}

// Image Generation Logs (persistent stats, never deleted with images)
export const imageGenLogs = {
  async getAll(userId: string): Promise<ImageGenLog[]> {
    const results = await getAll<ImageGenLog>(
      'imageGenLogs',
      where('userId', '==', userId)
    )
    return results.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async create(data: Omit<ImageGenLog, 'id' | 'createdAt'>): Promise<string> {
    return create('imageGenLogs', data)
  },
}

// Default permissions (all OFF)
export const DEFAULT_PROJECT_PERMISSIONS: ProjectPermissions = {
  viewProject: false, editProject: false, deleteProject: false,
  viewTasks: false, createTasks: false, editTasks: false, deleteTasks: false, changeTaskStatus: false, archiveTasks: false,
  viewNotes: false, createEditNotes: false, deleteNotes: false,
  viewAttachments: false, uploadAttachments: false, deleteAttachments: false,
  viewVault: false, createEditVault: false, deleteVault: false,
  viewPayments: false, createEditPayments: false, deletePayments: false,
  viewActivity: false,
  logTime: false, viewAllTimeEntries: false, editDeleteOthersTime: false,
}

export const DEFAULT_MODULE_PERMISSIONS: ModulePermissions = {
  createProjects: false,
  viewCalendar: false, createEditCalendar: false, deleteCalendar: false,
  viewMedia: false, uploadMedia: false, deleteMedia: false,
  viewFinances: false, viewTimesheets: false,
  accessAiAssistant: false, accessImageGenerator: false, accessSettings: false,
  viewTeam: false, createEditTeam: false, deleteTeam: false,
}

// Member Permissions
export const memberPermissions = {
  async getForMember(memberUid: string): Promise<MemberPermission[]> {
    return getAll<MemberPermission>('memberPermissions', where('memberUid', '==', memberUid))
  },

  async getForProject(memberUid: string, projectId: string): Promise<MemberPermission | null> {
    const results = await getAll<MemberPermission>(
      'memberPermissions',
      where('memberUid', '==', memberUid),
      where('projectId', '==', projectId)
    )
    return results[0] || null
  },

  async getGlobal(memberUid: string): Promise<MemberPermission | null> {
    return this.getForProject(memberUid, '__global__')
  },

  async setProjectPermissions(
    memberId: string,
    memberUid: string,
    projectId: string,
    permissions: ProjectPermissions
  ): Promise<string> {
    const existing = await this.getForProject(memberUid, projectId)
    if (existing) {
      await update('memberPermissions', existing.id, { permissions, updatedAt: Timestamp.now() })
      return existing.id
    }
    return create('memberPermissions', { memberId, memberUid, projectId, permissions })
  },

  async setModulePermissions(
    memberId: string,
    memberUid: string,
    modules: ModulePermissions
  ): Promise<string> {
    const existing = await this.getGlobal(memberUid)
    if (existing) {
      await update('memberPermissions', existing.id, { modules, updatedAt: Timestamp.now() })
      return existing.id
    }
    return create('memberPermissions', { memberId, memberUid, projectId: '__global__', modules })
  },

  async removeForProject(memberUid: string, projectId: string): Promise<void> {
    const existing = await this.getForProject(memberUid, projectId)
    if (existing) await remove('memberPermissions', existing.id)
  },

  async removeAllForMember(memberUid: string): Promise<void> {
    const all = await this.getForMember(memberUid)
    for (const p of all) await remove('memberPermissions', p.id)
  },
}

// Audit Logs
const AUDIT_RETENTION_DAYS = 90

export const auditLogs = {
  async create(data: AuditLogInput): Promise<string> {
    return create('auditLogs', data)
  },

  async getAll(filters?: {
    type?: AuditLogType
    actorUid?: string
    projectId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<AuditLog[]> {
    const constraints: QueryConstraint[] = []
    if (filters?.type) constraints.push(where('type', '==', filters.type))
    if (filters?.actorUid) constraints.push(where('actorUid', '==', filters.actorUid))
    if (filters?.projectId) constraints.push(where('projectId', '==', filters.projectId))
    if (filters?.startDate) constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.startDate)))
    if (filters?.endDate) constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.endDate)))

    const results = await getAll<AuditLog>('auditLogs', ...constraints)
    return results.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },

  async purgeOlderThan(days: number = AUDIT_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const old = await getAll<AuditLog>('auditLogs', where('createdAt', '<', Timestamp.fromDate(cutoff)))
    const batch = writeBatch(db)
    old.forEach((log) => batch.delete(doc(db, 'auditLogs', log.id)))
    if (old.length > 0) await batch.commit()
    return old.length
  },
}

/** Fire-and-forget audit log helper */
export function audit(data: AuditLogInput): void {
  auditLogs.create(data).catch(() => {})
}

// ===== Stage: Shape =====
export const projectShape = {
  async get(projectId: string): Promise<ProjectShape | null> {
    return getById<ProjectShape & { id: string }>('projectShape', projectId)
  },

  /** Upsert by docId = projectId. */
  async save(projectId: string, data: Omit<ProjectShape, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectShape', projectId)
    await setDoc(ref, { ...data, projectId, updatedAt: Timestamp.now() }, { merge: true })
    projects.touchStage(projectId, 'shape').catch(() => {})
    audit({ type: 'stage', action: 'shape_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

export const decisions = {
  async listByProject(projectId: string): Promise<Decision[]> {
    const all = await getAll<Decision>('decisions', where('projectId', '==', projectId))
    return all.sort((a, b) => b.decidedAt.toMillis() - a.decidedAt.toMillis())
  },

  async add(input: DecisionInput): Promise<string> {
    const id = await create('decisions', { ...input, decidedAt: Timestamp.now() })
    projects.touchStage(input.projectId, 'shape').catch(() => {})
    audit({ type: 'stage', action: 'decision_added', actorUid: input.authorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },

  async setStatus(id: string, projectId: string, status: DecisionStatus, actorId: string): Promise<void> {
    await update('decisions', id, { status })
    projects.touchStage(projectId, 'shape').catch(() => {})
    audit({ type: 'stage', action: 'decision_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },

  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('decisions', id)
    projects.touchStage(projectId, 'shape').catch(() => {})
    audit({ type: 'stage', action: 'decision_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

// ===== Stage: Market =====
export const projectMarket = {
  async get(projectId: string): Promise<ProjectMarket | null> {
    return getById<ProjectMarket & { id: string }>('projectMarket', projectId)
  },

  async save(projectId: string, data: Omit<ProjectMarket, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectMarket', projectId)
    await setDoc(ref, { ...data, projectId, updatedAt: Timestamp.now() }, { merge: true })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'market_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

export const marketChannels = {
  async listByProject(projectId: string): Promise<MarketChannel[]> {
    return getAll<MarketChannel>('marketChannels', where('projectId', '==', projectId))
  },
  async add(input: MarketChannelInput, actorId: string): Promise<string> {
    const id = await create('marketChannels', { ...input, url: input.url ?? null })
    projects.touchStage(input.projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'channel_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: MarketChannelStatus, actorId: string): Promise<void> {
    await update('marketChannels', id, { status })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'channel_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('marketChannels', id)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'channel_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const launchAssets = {
  async listByProject(projectId: string): Promise<LaunchAsset[]> {
    return getAll<LaunchAsset>('launchAssets', where('projectId', '==', projectId))
  },
  async add(input: LaunchAssetInput, actorId: string): Promise<string> {
    const id = await create('launchAssets', { ...input, url: input.url ?? null, ownerId: input.ownerId ?? null })
    projects.touchStage(input.projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'asset_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: LaunchAssetStatus, actorId: string): Promise<void> {
    await update('launchAssets', id, { status })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'asset_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('launchAssets', id)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'asset_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

// ===== Stage: Launch =====
export const projectLaunch = {
  async get(projectId: string): Promise<ProjectLaunch | null> {
    return getById<ProjectLaunch & { id: string }>('projectLaunch', projectId)
  },
  async save(projectId: string, data: Omit<ProjectLaunch, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectLaunch', projectId)
    await setDoc(ref, {
      ...data,
      projectId,
      releaseDate: data.releaseDate ?? null,
      updatedAt: Timestamp.now(),
    }, { merge: true })
    projects.touchStage(projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'launch_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

export const launchChecklist = {
  async listByProject(projectId: string): Promise<LaunchChecklistItem[]> {
    return getAll<LaunchChecklistItem>('launchChecklist', where('projectId', '==', projectId))
  },
  async add(input: LaunchChecklistItemInput, actorId: string): Promise<string> {
    const id = await create('launchChecklist', {
      ...input,
      dueDate: input.dueDate ?? null,
      ownerId: input.ownerId ?? null,
    })
    projects.touchStage(input.projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'checklist_item_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: LaunchChecklistStatus, actorId: string): Promise<void> {
    await update('launchChecklist', id, { status })
    projects.touchStage(projectId, 'launch').catch(() => {})
    const action = status === 'done' ? 'checklist_item_completed' : 'checklist_item_status_changed'
    audit({ type: 'stage', action, actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('launchChecklist', id)
    projects.touchStage(projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'checklist_item_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const monitoringLinks = {
  async listByProject(projectId: string): Promise<MonitoringLink[]> {
    return getAll<MonitoringLink>('monitoringLinks', where('projectId', '==', projectId))
  },
  async add(input: MonitoringLinkInput, actorId: string): Promise<string> {
    const id = await create('monitoringLinks', input)
    projects.touchStage(input.projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'monitoring_link_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('monitoringLinks', id)
    projects.touchStage(projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'monitoring_link_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

// ===== Stage: Repos =====
export const projectRepoGraph = {
  async get(projectId: string): Promise<ProjectRepoGraph | null> {
    return getById<ProjectRepoGraph & { id: string }>('projectRepoGraph', projectId)
  },
  async save(projectId: string, data: Omit<ProjectRepoGraph, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectRepoGraph', projectId)
    await setDoc(ref, { ...data, projectId, updatedAt: Timestamp.now() }, { merge: true })
    projects.touchStage(projectId, 'repos').catch(() => {})
    audit({ type: 'stage', action: 'repos_graph_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

/**
 * Snapshot of a project's repos, persisted by the local "Sync from sikagit" action.
 * Display + AI read this in BOTH dev and prod — no filesystem access required.
 */
export const projectRepos = {
  async get(projectId: string): Promise<ProjectRepos | null> {
    return getById<ProjectRepos & { id: string }>('projectRepos', projectId)
  },
  async save(projectId: string, repos: RepoSnapshot[], actorId: string): Promise<void> {
    const ref = doc(db, 'projectRepos', projectId)
    await setDoc(ref, { projectId, repos, syncedAt: Timestamp.now(), syncedBy: actorId }, { merge: false })
    projects.touchStage(projectId, 'repos').catch(() => {})
    audit({ type: 'stage', action: 'repos_synced', actorUid: actorId, actorEmail: '', projectId, targetId: projectId, details: { count: repos.length } })
  },
}

// ===== Stage: Deploy =====
export const projectDeploy = {
  async get(projectId: string): Promise<ProjectDeploy | null> {
    return getById<ProjectDeploy & { id: string }>('projectDeploy', projectId)
  },
  async save(projectId: string, data: Omit<ProjectDeploy, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectDeploy', projectId)
    await setDoc(ref, { ...data, projectId, updatedAt: Timestamp.now() }, { merge: true })
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'deploy_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

export const deployServers = {
  async listByProject(projectId: string): Promise<DeployServer[]> {
    return getAll<DeployServer>('deployServers', where('projectId', '==', projectId))
  },
  async add(input: DeployServerInput, actorId: string): Promise<string> {
    const id = await create('deployServers', {
      ...input,
      region: input.region ?? null,
      specs: input.specs ?? null,
      ip: input.ip ?? null,
      os: input.os ?? null,
      costMonthly: input.costMonthly ?? null,
      notes: input.notes ?? null,
    })
    projects.touchStage(input.projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'server_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async update(id: string, projectId: string, data: Partial<DeployServerInput>, actorId: string): Promise<void> {
    await update('deployServers', id, data as DocumentData)
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'server_updated', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('deployServers', id)
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'server_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const deployDomains = {
  async listByProject(projectId: string): Promise<DeployDomain[]> {
    return getAll<DeployDomain>('deployDomains', where('projectId', '==', projectId))
  },
  async add(input: DeployDomainInput, actorId: string): Promise<string> {
    const id = await create('deployDomains', {
      ...input,
      dnsProvider: input.dnsProvider ?? null,
      proxied: input.proxied ?? false,
      notes: input.notes ?? null,
    })
    projects.touchStage(input.projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'domain_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async update(id: string, projectId: string, data: Partial<DeployDomainInput>, actorId: string): Promise<void> {
    await update('deployDomains', id, data as DocumentData)
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'domain_updated', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('deployDomains', id)
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'domain_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

// ===== Stage: Next (AI compass) =====
export const nextSteps = {
  async listByProject(projectId: string): Promise<NextStep[]> {
    const all = await getAll<NextStep>('nextSteps', where('projectId', '==', projectId))
    // Newest batch first, then by rank within a batch.
    return all.sort((a, b) =>
      b.createdAt.toMillis() - a.createdAt.toMillis() || a.rank - b.rank)
  },
  async add(input: NextStepInput, actorId: string): Promise<string> {
    const id = await create('nextSteps', {
      ...input,
      status: 'pending',
      createdAt: Timestamp.now(),
      resolvedAt: null,
    })
    audit({ type: 'stage', action: 'next_step_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: NextStepStatus, actorId: string): Promise<void> {
    await update('nextSteps', id, { status, resolvedAt: status === 'pending' ? null : Timestamp.now() })
    audit({ type: 'stage', action: `next_step_${status}`, actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('nextSteps', id)
    audit({ type: 'stage', action: 'next_step_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

// ===== Stage: Design =====
export const projectDesign = {
  async get(projectId: string): Promise<ProjectDesign | null> {
    return getById<ProjectDesign & { id: string }>('projectDesign', projectId)
  },
  async save(projectId: string, data: Omit<ProjectDesign, 'projectId' | 'updatedAt'>, actorId: string): Promise<void> {
    const ref = doc(db, 'projectDesign', projectId)
    await setDoc(ref, { ...data, projectId, updatedAt: Timestamp.now() }, { merge: true })
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'design_updated', actorUid: actorId, actorEmail: '', projectId, targetId: projectId })
  },
}

export const designPrototypes = {
  async listByProject(projectId: string): Promise<DesignPrototype[]> {
    return getAll<DesignPrototype>('designPrototypes', where('projectId', '==', projectId))
  },
  async add(input: DesignPrototypeInput, actorId: string): Promise<string> {
    const id = await create('designPrototypes', { ...input, status: input.status ?? 'draft', notes: input.notes ?? null })
    projects.touchStage(input.projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'prototype_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async update(id: string, projectId: string, data: Partial<DesignPrototypeInput>, actorId: string): Promise<void> {
    await update('designPrototypes', id, data as DocumentData)
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'prototype_updated', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('designPrototypes', id)
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'prototype_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const designScreens = {
  async listByProject(projectId: string): Promise<DesignScreen[]> {
    const all = await getAll<DesignScreen>('designScreens', where('projectId', '==', projectId))
    return all.sort((a, b) => a.order - b.order)
  },
  async add(input: DesignScreenInput, actorId: string): Promise<string> {
    const id = await create('designScreens', { ...input, status: input.status ?? 'todo', order: input.order ?? Date.now() })
    projects.touchStage(input.projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'screen_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: DesignScreenStatus, actorId: string): Promise<void> {
    await update('designScreens', id, { status })
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'screen_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('designScreens', id)
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'screen_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const designImages = {
  async listByProject(projectId: string): Promise<DesignImage[]> {
    return getAll<DesignImage>('designImages', where('projectId', '==', projectId))
  },
  async add(input: DesignImageInput, actorId: string): Promise<string> {
    const id = await create('designImages', { ...input, caption: input.caption ?? null })
    projects.touchStage(input.projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'design_image_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('designImages', id)
    projects.touchStage(projectId, 'design').catch(() => {})
    audit({ type: 'stage', action: 'design_image_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const marketListings = {
  async listByProject(projectId: string): Promise<MarketListing[]> {
    const all = await getAll<MarketListing>('marketListings', where('projectId', '==', projectId))
    return all.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },
  async add(input: MarketListingInput, actorId: string): Promise<string> {
    const id = await create('marketListings', {
      ...input,
      model: input.model ?? 'one_time',
      status: input.status ?? 'preparing',
      price: input.price ?? null,
      url: input.url ?? null,
      notes: input.notes ?? null,
      createdAt: Timestamp.now(),
    })
    projects.touchStage(input.projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'listing_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: MarketListingStatus, actorId: string): Promise<void> {
    await update('marketListings', id, { status })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'listing_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('marketListings', id)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'listing_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const marketPlaybook = {
  async listByProject(projectId: string): Promise<MarketPlaybookItem[]> {
    const all = await getAll<MarketPlaybookItem>('marketPlaybook', where('projectId', '==', projectId))
    return all.sort((a, b) => a.order - b.order)
  },
  async add(input: MarketPlaybookItemInput, actorId: string): Promise<string> {
    const id = await create('marketPlaybook', {
      ...input,
      status: input.status ?? 'todo',
      order: input.order ?? Date.now(),
      createdAt: Timestamp.now(),
    })
    projects.touchStage(input.projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'playbook_item_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: MarketPlaybookStatus, actorId: string): Promise<void> {
    await update('marketPlaybook', id, { status })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'playbook_item_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('marketPlaybook', id)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'playbook_item_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const marketCampaigns = {
  async listByProject(projectId: string): Promise<MarketCampaign[]> {
    const all = await getAll<MarketCampaign>('marketCampaigns', where('projectId', '==', projectId))
    return all.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
  },
  async add(input: MarketCampaignInput, actorId: string): Promise<string> {
    const id = await create('marketCampaigns', {
      ...input,
      status: input.status ?? 'planned',
      notes: input.notes ?? null,
      result: input.result ?? null,
      createdAt: Timestamp.now(),
    })
    projects.touchStage(input.projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'campaign_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async update(id: string, projectId: string, data: Partial<MarketCampaignInput>, actorId: string): Promise<void> {
    await update('marketCampaigns', id, data as DocumentData)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'campaign_updated', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
  async setStatus(id: string, projectId: string, status: MarketCampaignStatus, actorId: string): Promise<void> {
    await update('marketCampaigns', id, { status })
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'campaign_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('marketCampaigns', id)
    projects.touchStage(projectId, 'market').catch(() => {})
    audit({ type: 'stage', action: 'campaign_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

export const socialPosts = {
  /** All posts for a project, newest first by scheduledAt ?? createdAt (sorted client-side to avoid composite index). */
  async listByProject(projectId: string): Promise<SocialPost[]> {
    const all = await getAll<SocialPost>('socialPosts', where('projectId', '==', projectId))
    return all.sort((a, b) => {
      const aMs = (a.scheduledAt ?? a.createdAt)?.toMillis() ?? 0
      const bMs = (b.scheduledAt ?? b.createdAt)?.toMillis() ?? 0
      return bMs - aMs
    })
  },
  /** Posts due to publish: status === 'scheduled' AND scheduledAt <= now. Query by status only, filter scheduledAt client-side. */
  async getDue(nowMs: number): Promise<SocialPost[]> {
    const scheduled = await getAll<SocialPost>('socialPosts', where('status', '==', 'scheduled'))
    return scheduled.filter((p) => p.scheduledAt != null && p.scheduledAt.toMillis() <= nowMs)
  },
  /** Create a post; sets createdAt/updatedAt and defaults createdBy to actorId. Returns new doc id. */
  async add(input: SocialPostInput, actorId: string): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(collection(db, 'socialPosts'), {
      ...input,
      createdBy: input.createdBy ?? actorId,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },
  /** Patch fields; always bumps updatedAt. */
  async update(id: string, patch: Partial<SocialPost>): Promise<void> {
    const docRef = doc(db, 'socialPosts', id)
    await updateDoc(docRef, {
      ...patch,
      updatedAt: Timestamp.now(),
    })
  },
  /** Set status (+ optional extra fields like publishedAt/fbPostId/igMediaId/error/attempts); bumps updatedAt. */
  async setStatus(id: string, status: SocialPostStatus, extra?: Partial<SocialPost>): Promise<void> {
    const docRef = doc(db, 'socialPosts', id)
    await updateDoc(docRef, {
      ...extra,
      status,
      updatedAt: Timestamp.now(),
    })
  },
}

export const socialInsights = {
  /** Most recent insight for a scope+refId (query by scope+refId, sort by capturedAt client-side, return first or null). */
  async latest(scope: InsightScope, refId: string): Promise<SocialInsight | null> {
    const all = await getAll<SocialInsight>(
      'socialInsights',
      where('scope', '==', scope),
      where('refId', '==', refId),
    )
    const sorted = all.sort((a, b) => (b.capturedAt?.toMillis() ?? 0) - (a.capturedAt?.toMillis() ?? 0))
    return sorted[0] ?? null
  },
  /** Save a new insight snapshot; defaults capturedAt to now if not provided. */
  async save(input: Omit<SocialInsight, 'id'>): Promise<void> {
    await addDoc(collection(db, 'socialInsights'), {
      ...input,
      capturedAt: input.capturedAt ?? Timestamp.now(),
    })
  },
}

export const deployRecommendations = {
  async listByProject(projectId: string): Promise<DeployRecommendation[]> {
    const all = await getAll<DeployRecommendation>('deployRecommendations', where('projectId', '==', projectId))
    const sevRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 }
    return all.sort((a, b) => sevRank[a.severity] - sevRank[b.severity])
  },
  async add(input: DeployRecommendationInput, actorId: string): Promise<string> {
    const id = await create('deployRecommendations', {
      ...input,
      status: input.status ?? 'open',
      createdAt: Timestamp.now(),
    })
    projects.touchStage(input.projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'deploy_rec_added', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: DeployRecStatus, actorId: string): Promise<void> {
    await update('deployRecommendations', id, { status })
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'deploy_rec_status_changed', actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('deployRecommendations', id)
    projects.touchStage(projectId, 'deploy').catch(() => {})
    audit({ type: 'stage', action: 'deploy_rec_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}

/** Cap stored README text well under Firestore's 1 MB/doc limit. */
const README_MAX_CHARS = 60000

export const repoSummaries = {
  async listByProject(projectId: string): Promise<RepoSummary[]> {
    return getAll<RepoSummary>('repoSummaries', where('projectId', '==', projectId))
  },
  /**
   * Merge-upsert summary and/or README for one project+repo, by deterministic doc id.
   * README is capped (truncated with a marker) to stay under Firestore's per-doc size limit.
   */
  async saveData(
    projectId: string,
    repoId: string,
    data: { summary?: string | null; readme?: string | null },
    actorId: string,
  ): Promise<void> {
    const ref = doc(db, 'repoSummaries', `${projectId}_${repoId}`)
    const payload: DocumentData = { projectId, repoId, generatedAt: Timestamp.now() }
    if (data.summary !== undefined) payload.summary = data.summary
    if (data.readme !== undefined) {
      payload.readme =
        data.readme && data.readme.length > README_MAX_CHARS
          ? data.readme.slice(0, README_MAX_CHARS) + '\n…(truncated)'
          : data.readme
    }
    await setDoc(ref, payload, { merge: true })
    audit({ type: 'stage', action: 'repo_summary_generated', actorUid: actorId, actorEmail: '', projectId, targetId: repoId })
  },
  /** Upsert by deterministic doc id so each project+repo pair has exactly one summary. */
  async save(projectId: string, repoId: string, summary: string, actorId: string): Promise<void> {
    return repoSummaries.saveData(projectId, repoId, { summary }, actorId)
  },
}

export const postLaunchIssues = {
  async listByProject(projectId: string): Promise<PostLaunchIssue[]> {
    const all = await getAll<PostLaunchIssue>('postLaunchIssues', where('projectId', '==', projectId))
    return all.sort((a, b) => b.reportedAt.toMillis() - a.reportedAt.toMillis())
  },
  async add(input: PostLaunchIssueInput, actorId: string): Promise<string> {
    const id = await create('postLaunchIssues', { ...input, reportedAt: Timestamp.now() })
    projects.touchStage(input.projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'post_launch_issue_opened', actorUid: actorId, actorEmail: '', projectId: input.projectId, targetId: id })
    return id
  },
  async setStatus(id: string, projectId: string, status: PostLaunchIssueStatus, actorId: string): Promise<void> {
    await update('postLaunchIssues', id, { status })
    projects.touchStage(projectId, 'launch').catch(() => {})
    const action = status === 'resolved' ? 'post_launch_issue_resolved' : 'post_launch_issue_status_changed'
    audit({ type: 'stage', action, actorUid: actorId, actorEmail: '', projectId, targetId: id, details: { status } })
  },
  async remove(id: string, projectId: string, actorId: string): Promise<void> {
    await remove('postLaunchIssues', id)
    projects.touchStage(projectId, 'launch').catch(() => {})
    audit({ type: 'stage', action: 'post_launch_issue_removed', actorUid: actorId, actorEmail: '', projectId, targetId: id })
  },
}
