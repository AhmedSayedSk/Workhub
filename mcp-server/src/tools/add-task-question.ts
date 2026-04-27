import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuthor } from '../lib/author.js';

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

  // Look up the project name to denormalize for the dashboard card
  let projectName = task.projectId as string;
  const projectDoc = await db.collection('projects').doc(task.projectId).get();
  if (projectDoc.exists) {
    projectName = (projectDoc.data()?.name as string) || projectName;
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

  return {
    content: [{
      type: 'text' as const,
      text: `Question added to task **${task.name}**.\n- **Question ID:** \`${ref.id}\`\n- **Asked by:** ${askedBy}\n\nThe owner will see this in the WorkHub UI and answer it. Use \`list_task_questions\` later to read the answer.`,
    }],
  };
}
