import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const updateTaskStatusSchema = {
  taskId: z.string().describe('The task ID to update'),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).describe('The new status'),
  comment: z.string().optional().describe('Optional comment to add about the status change'),
};

export async function updateTaskStatus(args: {
  taskId: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  comment?: string;
}) {
  const db = getDb();

  // Fetch current task
  const taskDoc = await db.collection('tasks').doc(args.taskId).get();
  if (!taskDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }

  const task = taskDoc.data()!;
  const oldStatus = task.status as string;

  if (oldStatus === args.status) {
    return {
      content: [{ type: 'text' as const, text: `Task is already in \`${args.status}\` status.` }],
    };
  }

  // Build update — match src/lib/firestore.ts doneAt logic
  const updates: Record<string, unknown> = {
    status: args.status,
  };

  if (args.status === 'done') {
    updates.doneAt = Timestamp.now();
  } else {
    updates.doneAt = null;
  }

  // Update task
  await db.collection('tasks').doc(args.taskId).update(updates);

  // Create project log entry — match src/hooks/useTasks.ts pattern
  await db.collection('projectLogs').add({
    projectId: task.projectId,
    action: 'task_status_changed',
    changes: [{
      field: 'task_status',
      oldValue: `${task.name}: ${oldStatus}`,
      newValue: `${task.name}: ${args.status}`,
    }],
    createdAt: Timestamp.now(),
  });

  // Optionally add a comment
  if (args.comment) {
    await db.collection('taskComments').add({
      parentId: args.taskId,
      parentType: 'task',
      text: args.comment,
      authorId: 'claude-code',
      authorName: 'Claude Code',
      createdAt: Timestamp.now(),
    });
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Task **${task.name}** status changed: \`${oldStatus}\` → \`${args.status}\``,
    }],
  };
}
