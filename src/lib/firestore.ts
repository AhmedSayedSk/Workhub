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
  Timestamp,
  QueryConstraint,
  DocumentData,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import {
  Organization,
  OrganizationInput,
  System,
  SystemInput,
  Project,
  ProjectInput,
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
  await updateDoc(docRef, data as DocumentData)
}

async function remove(collectionName: string, id: string): Promise<void> {
  const docRef = doc(db, collectionName, id)
  await deleteDoc(docRef)
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

// Systems
export const systems = {
  async getAll(organizationId?: string): Promise<System[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (organizationId) {
      constraints.unshift(where('organizationId', '==', organizationId))
    }
    return getAll<System>('systems', ...constraints)
  },

  async getById(id: string): Promise<System | null> {
    return getById<System>('systems', id)
  },

  async create(data: SystemInput): Promise<string> {
    return create('systems', data)
  },

  async update(id: string, data: Partial<SystemInput>): Promise<void> {
    return update('systems', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('systems', id)
  },
}

// Projects
export const projects = {
  async getAll(systemId?: string): Promise<Project[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (systemId) {
      constraints.unshift(where('systemId', '==', systemId))
    }
    return getAll<Project>('projects', ...constraints)
  },

  async getById(id: string): Promise<Project | null> {
    return getById<Project>('projects', id)
  },

  async create(data: ProjectInput): Promise<string> {
    return create('projects', {
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      deadline: toTimestamp(data.deadline),
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
    return update('projects', id, updateData)
  },

  async delete(id: string): Promise<void> {
    return remove('projects', id)
  },

  async getByStatus(status: string): Promise<Project[]> {
    return getAll<Project>('projects', where('status', '==', status), orderBy('createdAt', 'desc'))
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
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')]
    if (featureId) {
      constraints.unshift(where('featureId', '==', featureId))
    } else if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<Task>('tasks', ...constraints)
  },

  async getById(id: string): Promise<Task | null> {
    return getById<Task>('tasks', id)
  },

  async create(data: TaskInput): Promise<string> {
    return create('tasks', { ...data, actualHours: 0 })
  },

  async update(id: string, data: Partial<TaskInput>): Promise<void> {
    return update('tasks', id, data)
  },

  async delete(id: string): Promise<void> {
    return remove('tasks', id)
  },

  async getByStatus(status: string, projectId?: string): Promise<Task[]> {
    const constraints: QueryConstraint[] = [
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
    ]
    if (projectId) {
      constraints.unshift(where('projectId', '==', projectId))
    }
    return getAll<Task>('tasks', ...constraints)
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

// Batch operations
export const batch = {
  async deleteProjectCascade(projectId: string): Promise<void> {
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

    // Get subtasks for all tasks
    const taskIds = projectTasks.map((t) => t.id)
    const allSubtasks: Subtask[] = []
    for (const taskId of taskIds) {
      const taskSubtasks = await subtasks.getAll(taskId)
      allSubtasks.push(...taskSubtasks)
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

  async deleteSystemCascade(systemId: string): Promise<void> {
    // Get all projects in this system
    const systemProjects = await projects.getAll(systemId)

    // Delete each project with cascade
    for (const project of systemProjects) {
      await this.deleteProjectCascade(project.id)
    }

    // Delete the system itself
    await systems.delete(systemId)
  },
}
