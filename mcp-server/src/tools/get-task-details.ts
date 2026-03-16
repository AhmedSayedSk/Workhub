import { z } from 'zod';
import { getDb } from '../firebase.js';

export const getTaskDetailsSchema = {
  taskId: z.string().describe('The task ID to get details for'),
};

export async function getTaskDetails(args: { taskId: string }) {
  const db = getDb();

  // Fetch task
  const taskDoc = await db.collection('tasks').doc(args.taskId).get();
  if (!taskDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }

  const task = taskDoc.data()!;

  // Resolve project name
  let projectName = task.projectId;
  const projectDoc = await db.collection('projects').doc(task.projectId).get();
  if (projectDoc.exists) {
    projectName = projectDoc.data()?.name || projectName;
  }

  // Resolve feature name
  let featureName = '';
  if (task.featureId) {
    const featureDoc = await db.collection('features').doc(task.featureId).get();
    if (featureDoc.exists) {
      featureName = featureDoc.data()?.name || '';
    }
  }

  // Fetch subtasks
  const subtasksSnapshot = await db.collection('subtasks')
    .where('taskId', '==', args.taskId)
    .orderBy('createdAt', 'asc')
    .get();

  const subtasks = subtasksSnapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name as string,
    status: doc.data().status as string,
    estimatedMinutes: doc.data().estimatedMinutes as number,
  }));

  // Count comments
  const commentsSnapshot = await db.collection('taskComments')
    .where('parentId', '==', args.taskId)
    .where('parentType', '==', 'task')
    .get();

  const commentCount = commentsSnapshot.size;

  // Build markdown output
  const lines: string[] = [];
  lines.push(`# ${task.name}`);
  lines.push('');
  lines.push(`- **Project:** ${projectName}`);
  if (featureName) lines.push(`- **Feature:** ${featureName}`);
  lines.push(`- **Status:** ${task.status}`);
  lines.push(`- **Priority:** ${task.priority}`);
  lines.push(`- **Type:** ${task.taskType || 'task'}`);
  if (task.estimatedHours) lines.push(`- **Estimated Hours:** ${task.estimatedHours}`);
  if (task.actualHours) lines.push(`- **Actual Hours:** ${task.actualHours}`);
  if (task.assigneeIds?.length) lines.push(`- **Assignees:** ${task.assigneeIds.length} member(s)`);
  if (task.deadline) lines.push(`- **Deadline:** ${task.deadline.toDate().toISOString().split('T')[0]}`);
  lines.push(`- **Comments:** ${commentCount}`);
  lines.push(`- **Task ID:** \`${args.taskId}\``);
  lines.push(`- **Project ID:** \`${task.projectId}\``);
  if (task.featureId) lines.push(`- **Feature ID:** \`${task.featureId}\``);

  if (task.description) {
    lines.push('');
    lines.push('## Description');
    lines.push('');
    lines.push(task.description);
  }

  if (subtasks.length > 0) {
    lines.push('');
    lines.push(`## Subtasks (${subtasks.length})`);
    lines.push('');
    for (const st of subtasks) {
      const est = st.estimatedMinutes ? ` (${st.estimatedMinutes}m)` : '';
      const check = st.status === 'done' ? '[x]' : '[ ]';
      lines.push(`- ${check} ${st.name}${est} — ID: \`${st.id}\``);
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: lines.join('\n'),
    }],
  };
}
