import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const addTaskCommentSchema = {
  taskId: z.string().describe('The task ID to comment on'),
  text: z.string().describe('The comment text (supports markdown)'),
  parentType: z.enum(['task', 'subtask']).optional().describe('Whether this is a task or subtask comment (defaults to task)'),
};

export async function addTaskComment(args: {
  taskId: string;
  text: string;
  parentType?: 'task' | 'subtask';
}) {
  const db = getDb();

  // Validate task exists
  const parentType = args.parentType || 'task';
  const collection = parentType === 'subtask' ? 'subtasks' : 'tasks';
  const parentDoc = await db.collection(collection).doc(args.taskId).get();
  if (!parentDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${parentType} with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }

  const parentData = parentDoc.data()!;

  // Create comment — matches TaskComment interface from src/types/index.ts
  const commentData = {
    parentId: args.taskId,
    parentType,
    text: args.text,
    authorId: 'claude-code',
    authorName: 'Claude Code',
    createdAt: Timestamp.now(),
  };

  const docRef = await db.collection('taskComments').add(commentData);

  // Create project log — resolve projectId depending on parent type
  let projectId = parentData.projectId;
  if (parentType === 'subtask' && parentData.taskId) {
    const taskDoc = await db.collection('tasks').doc(parentData.taskId).get();
    if (taskDoc.exists) {
      projectId = taskDoc.data()?.projectId || projectId;
    }
  }

  if (projectId) {
    const commentPreview = args.text.length > 120 ? args.text.slice(0, 120) + '...' : args.text;
    await db.collection('projectLogs').add({
      projectId,
      action: 'comment_added',
      changes: [{
        field: 'comment',
        oldValue: null,
        newValue: `${parentData.name}: ${commentPreview}`,
      }],
      createdAt: Timestamp.now(),
    });
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Comment added to **${parentData.name}**.\nComment ID: \`${docRef.id}\``,
    }],
  };
}
