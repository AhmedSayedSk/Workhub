import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuthor } from '../lib/author.js';
import { notifyEmail } from '../lib/notify-email.js';

export const addTaskQuestionSchema = {
  taskId: z.string().describe('The task ID this question is about'),
  question: z.string().min(1).describe('The question text. Phrase it so the owner can answer with the context Claude needs to execute the task.'),
  askedBy: z
    .string()
    .optional()
    .describe('Optional identifier for who/what is asking. Defaults to the configured MCP author name.'),
};

export async function addTaskQuestion(args: { taskId: string; question: string; askedBy?: string }) {
  const db = getDb();

  const taskDoc = await db.collection('tasks').doc(args.taskId).get();
  if (!taskDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }
  const task = taskDoc.data()!;
  const askedBy = args.askedBy?.trim() || getAuthor().authorName;

  // Look up the project to denormalize name for the dashboard card and resolve owner for email
  let projectName = task.projectId as string;
  let projectOwnerId: string | null = null;
  const projectDoc = await db.collection('projects').doc(task.projectId).get();
  if (projectDoc.exists) {
    const p = projectDoc.data();
    projectName = (p?.name as string) || projectName;
    projectOwnerId = (p?.ownerId as string) || null;
  }

  const ref = await db.collection('taskQuestions').add({
    taskId: args.taskId,
    taskName: task.name,
    projectId: task.projectId,
    projectName,
    question: args.question,
    askedBy,
    askedAt: Timestamp.now(),
    answer: null,
    answeredAt: null,
    answeredBy: null,
  });

  // Fire-and-forget email to the project owner
  if (projectOwnerId) {
    try {
      const ownerSnap = await db.collection('userProfiles').doc(projectOwnerId).get();
      const owner = ownerSnap.exists ? ownerSnap.data() : null;
      if (owner?.email) {
        void notifyEmail({
          type: 'task_question_asked',
          payload: {
            recipients: [{ email: owner.email as string, name: (owner.displayName as string) || (owner.email as string) }],
            actorName: askedBy,
            taskName: task.name,
            projectName,
            projectId: task.projectId,
            taskId: args.taskId,
            question: args.question,
          },
        });
      }
    } catch {
      // ignore — email is best-effort
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Question added to task **${task.name}**.\n- **Question ID:** \`${ref.id}\`\n- **Asked by:** ${askedBy}\n\nThe owner will see this in the WorkHub UI and answer it. Use \`list_task_questions\` later to read the answer.`,
    }],
  };
}
