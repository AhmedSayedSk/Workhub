import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const updateTaskAssigneesSchema = {
  taskId: z.string().describe('The task ID to update'),
  memberIds: z.array(z.string()).describe('Member IDs to apply. Use list_members to resolve names to IDs.'),
  mode: z
    .enum(['set', 'add', 'remove'])
    .optional()
    .describe("'set' replaces the list, 'add' appends, 'remove' removes. Defaults to 'set'."),
};

export async function updateTaskAssignees(args: {
  taskId: string;
  memberIds: string[];
  mode?: 'set' | 'add' | 'remove';
}) {
  const db = getDb();
  const mode = args.mode ?? 'set';

  const taskDoc = await db.collection('tasks').doc(args.taskId).get();
  if (!taskDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }
  const task = taskDoc.data()!;
  const oldIds: string[] = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];

  // Validate provided member IDs exist (only those being added matter for 'add'/'set')
  const idsToCheck =
    mode === 'remove' ? [] : Array.from(new Set(args.memberIds));

  const missing: string[] = [];
  for (const id of idsToCheck) {
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

  let newIds: string[];
  if (mode === 'set') {
    newIds = Array.from(new Set(args.memberIds));
  } else if (mode === 'add') {
    newIds = Array.from(new Set([...oldIds, ...args.memberIds]));
  } else {
    const toRemove = new Set(args.memberIds);
    newIds = oldIds.filter((id) => !toRemove.has(id));
  }

  const unchanged =
    newIds.length === oldIds.length && newIds.every((id) => oldIds.includes(id));
  if (unchanged) {
    return {
      content: [{
        type: 'text' as const,
        text: `No change: task **${task.name}** already has these assignees.`,
      }],
    };
  }

  await db.collection('tasks').doc(args.taskId).update({ assigneeIds: newIds });

  // Build readable names for the audit log
  const allIds = Array.from(new Set([...oldIds, ...newIds]));
  const nameMap = new Map<string, string>();
  for (const id of allIds) {
    const snap = await db.collection('members').doc(id).get();
    nameMap.set(id, (snap.data()?.name as string) || id);
  }
  const fmt = (ids: string[]) =>
    ids.length === 0 ? '(none)' : ids.map((id) => nameMap.get(id) || id).join(', ');

  await db.collection('projectLogs').add({
    projectId: task.projectId,
    action: 'task_assignees_changed',
    changes: [{
      field: 'task_assignees',
      oldValue: `${task.name}: ${fmt(oldIds)}`,
      newValue: `${task.name}: ${fmt(newIds)}`,
    }],
    createdAt: Timestamp.now(),
  });

  return {
    content: [{
      type: 'text' as const,
      text: `Task **${task.name}** assignees updated: ${fmt(oldIds)} → ${fmt(newIds)}`,
    }],
  };
}
