import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const createTaskSchema = {
  projectId: z.string().describe('The project ID this task belongs to'),
  name: z.string().min(1).describe('Task name (required)'),
  description: z.string().optional().describe('Task description (markdown allowed)'),
  status: z
    .enum(['todo', 'in_progress', 'review', 'done'])
    .optional()
    .describe("Initial status. Defaults to 'todo'."),
  taskType: z
    .enum(['task', 'bug', 'feature', 'improvement', 'documentation', 'research'])
    .optional()
    .describe("Task type. Defaults to 'task'."),
  priority: z
    .enum(['low', 'medium', 'high'])
    .optional()
    .describe("Priority. Defaults to 'medium'."),
  estimatedHours: z.number().nonnegative().optional().describe('Estimated hours to complete. Defaults to 0.'),
  featureId: z.string().optional().describe('Optional feature ID to attach this task to. If provided, the feature must exist and belong to the same project.'),
  deadline: z
    .string()
    .optional()
    .describe("Optional deadline as ISO date string (e.g. '2026-05-30' or '2026-05-30T17:00:00Z')."),
  assigneeIds: z
    .array(z.string())
    .optional()
    .describe('Optional list of member IDs to assign. Use list_members to resolve names to IDs.'),
  skipAutoAssign: z
    .boolean()
    .optional()
    .describe('When true, the task will not be auto-assigned to any user or role.'),
  icon: z.string().optional().describe('Optional Lucide icon name for the task.'),
  waiting: z.boolean().optional().describe('Mark task as waiting/blocked.'),
  waitingReason: z.string().optional().describe('Reason for the waiting state (only used when waiting is true).'),
  sortOrder: z.number().optional().describe('Custom sort order. Defaults to current timestamp (placed at end).'),
};

export async function createTask(args: {
  projectId: string;
  name: string;
  description?: string;
  status?: 'todo' | 'in_progress' | 'review' | 'done';
  taskType?: 'task' | 'bug' | 'feature' | 'improvement' | 'documentation' | 'research';
  priority?: 'low' | 'medium' | 'high';
  estimatedHours?: number;
  featureId?: string;
  deadline?: string;
  assigneeIds?: string[];
  skipAutoAssign?: boolean;
  icon?: string;
  waiting?: boolean;
  waitingReason?: string;
  sortOrder?: number;
}) {
  const db = getDb();

  // Validate project
  const projectDoc = await db.collection('projects').doc(args.projectId).get();
  if (!projectDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Project with ID \`${args.projectId}\` not found.` }],
      isError: true,
    };
  }
  const projectName = (projectDoc.data()?.name as string) || args.projectId;

  // Validate feature (if provided)
  let featureName = '';
  const featureId = args.featureId?.trim() || '';
  if (featureId) {
    const featureDoc = await db.collection('features').doc(featureId).get();
    if (!featureDoc.exists) {
      return {
        content: [{ type: 'text' as const, text: `Error: Feature with ID \`${featureId}\` not found.` }],
        isError: true,
      };
    }
    const fdata = featureDoc.data()!;
    if (fdata.projectId !== args.projectId) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: Feature \`${featureId}\` belongs to a different project.`,
        }],
        isError: true,
      };
    }
    featureName = (fdata.name as string) || '';
  }

  // Validate assignees
  const assigneeIds = Array.from(new Set(args.assigneeIds ?? []));
  if (assigneeIds.length > 0) {
    const missing: string[] = [];
    for (const id of assigneeIds) {
      const m = await db.collection('members').doc(id).get();
      if (!m.exists) missing.push(id);
    }
    if (missing.length > 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: These member IDs were not found: ${missing.map((id) => `\`${id}\``).join(', ')}`,
        }],
        isError: true,
      };
    }
  }

  // Parse deadline
  let deadline: Timestamp | null = null;
  if (args.deadline) {
    const parsed = new Date(args.deadline);
    if (isNaN(parsed.getTime())) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: Could not parse deadline \`${args.deadline}\`. Use an ISO date string like '2026-05-30'.`,
        }],
        isError: true,
      };
    }
    deadline = Timestamp.fromDate(parsed);
  }

  const status = args.status ?? 'todo';
  const taskType = args.taskType ?? 'task';
  const priority = args.priority ?? 'medium';
  const estimatedHours = args.estimatedHours ?? 0;
  const sortOrder = args.sortOrder ?? Date.now();

  // Build the task document — only include fields with values to keep
  // the document clean (matches the optimistic shape in useTasks.ts).
  const taskDoc: Record<string, unknown> = {
    projectId: args.projectId,
    featureId,
    name: args.name,
    description: args.description ?? '',
    status,
    taskType,
    priority,
    estimatedHours,
    actualHours: 0,
    sortOrder,
    createdAt: Timestamp.now(),
  };
  if (status === 'done') taskDoc.doneAt = Timestamp.now();
  if (deadline) taskDoc.deadline = deadline;
  if (assigneeIds.length > 0) taskDoc.assigneeIds = assigneeIds;
  if (args.skipAutoAssign) taskDoc.skipAutoAssign = true;
  if (args.icon) taskDoc.icon = args.icon;
  if (args.waiting) {
    taskDoc.waiting = true;
    taskDoc.waitingAt = Timestamp.now();
    if (args.waitingReason) taskDoc.waitingReason = args.waitingReason;
  }

  const ref = await db.collection('tasks').add(taskDoc);

  // Mirror the project log written by useTasks.createTask
  await db.collection('projectLogs').add({
    projectId: args.projectId,
    action: 'task_created',
    changes: [{ field: 'task', oldValue: null, newValue: args.name }],
    createdAt: Timestamp.now(),
  });

  // Build a readable summary
  const lines: string[] = [];
  lines.push(`Task **${args.name}** created in **${projectName}**.`);
  lines.push('');
  lines.push(`- **ID:** \`${ref.id}\``);
  lines.push(`- **Status:** ${status}`);
  lines.push(`- **Type:** ${taskType}`);
  lines.push(`- **Priority:** ${priority}`);
  if (estimatedHours) lines.push(`- **Estimated Hours:** ${estimatedHours}`);
  if (featureName) lines.push(`- **Feature:** ${featureName}`);
  if (deadline) lines.push(`- **Deadline:** ${deadline.toDate().toISOString().split('T')[0]}`);
  if (assigneeIds.length) lines.push(`- **Assignees:** ${assigneeIds.length} member(s)`);
  if (args.waiting) lines.push(`- **Waiting:** ${args.waitingReason ?? 'yes'}`);

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
