import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuthor } from '../lib/author.js';

export const deleteTaskCommentSchema = {
  commentId: z.string().describe('The taskComments doc ID to delete'),
  force: z
    .boolean()
    .optional()
    .describe(
      'Set true to allow deleting a comment authored by someone other than this MCP. Defaults to false for safety.'
    ),
};

export async function deleteTaskComment(args: {
  commentId: string;
  force?: boolean;
}) {
  const db = getDb();

  const ref = db.collection('taskComments').doc(args.commentId);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: comment \`${args.commentId}\` not found.` }],
      isError: true,
    };
  }

  const data = snap.data()!;
  const { authorId } = getAuthor();

  // By default, only delete comments this MCP authored. `force: true` overrides
  // but we still refuse if the original author is missing metadata.
  if (!args.force && data.authorId && data.authorId !== authorId) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error: comment \`${args.commentId}\` was authored by \`${data.authorName ?? data.authorId}\`, not this MCP (\`${authorId}\`). Pass \`force: true\` to delete anyway.`,
      }],
      isError: true,
    };
  }

  // Capture parent/project info BEFORE delete so we can still write the log.
  const parentType = data.parentType as 'task' | 'subtask' | undefined;
  const parentId = data.parentId as string | undefined;
  const originalText = data.text as string | undefined;

  await ref.delete();

  if (parentType && parentId) {
    const parentCollection = parentType === 'subtask' ? 'subtasks' : 'tasks';
    const parentDoc = await db.collection(parentCollection).doc(parentId).get();
    if (parentDoc.exists) {
      const parentData = parentDoc.data()!;
      let projectId = parentData.projectId as string | undefined;
      if (parentType === 'subtask' && parentData.taskId) {
        const taskDoc = await db.collection('tasks').doc(parentData.taskId).get();
        if (taskDoc.exists) {
          projectId = taskDoc.data()?.projectId || projectId;
        }
      }
      if (projectId) {
        const preview = (originalText || '').length > 120
          ? (originalText || '').slice(0, 120) + '...'
          : originalText || '';
        await db.collection('projectLogs').add({
          projectId,
          action: 'comment_deleted',
          changes: [{
            field: 'comment',
            oldValue: `${parentData.name}: ${preview}`,
            newValue: null,
          }],
          createdAt: Timestamp.now(),
        });
      }
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Comment \`${args.commentId}\` deleted.`,
    }],
  };
}
