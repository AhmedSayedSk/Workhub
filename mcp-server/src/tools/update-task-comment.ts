import { z } from 'zod';
import { getDb } from '../firebase.js';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuthor } from '../lib/author.js';

export const updateTaskCommentSchema = {
  commentId: z.string().describe('The taskComments doc ID to edit'),
  text: z.string().describe('The new comment text (supports markdown). Replaces the existing text.'),
};

export async function updateTaskComment(args: {
  commentId: string;
  text: string;
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

  // Only let the MCP rewrite comments it authored. Prevents accidentally
  // editing comments made by a human reviewer via the web UI.
  if (data.authorId && data.authorId !== authorId) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error: comment \`${args.commentId}\` was authored by \`${data.authorName ?? data.authorId}\`, not this MCP (\`${authorId}\`). Refusing to edit.`,
      }],
      isError: true,
    };
  }

  await ref.update({
    text: args.text,
    // Track that the comment was edited so the WorkHub UI can show an "edited" hint.
    editedAt: Timestamp.now(),
  });

  // Project log breadcrumb (best-effort — same pattern as add-task-comment)
  const parentType = data.parentType as 'task' | 'subtask' | undefined;
  const parentId = data.parentId as string | undefined;
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
        const preview = args.text.length > 120 ? args.text.slice(0, 120) + '...' : args.text;
        await db.collection('projectLogs').add({
          projectId,
          action: 'comment_edited',
          changes: [{
            field: 'comment',
            oldValue: data.text ?? null,
            newValue: `${parentData.name}: ${preview}`,
          }],
          createdAt: Timestamp.now(),
        });
      }
    }
  }

  // Silence the unused-import warning without touching behavior.
  void FieldValue;

  return {
    content: [{
      type: 'text' as const,
      text: `Comment \`${args.commentId}\` updated.`,
    }],
  };
}
