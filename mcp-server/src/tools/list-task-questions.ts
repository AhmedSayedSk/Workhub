import { z } from 'zod';
import { getDb } from '../firebase.js';

export const listTaskQuestionsSchema = {
  taskId: z.string().describe('The task ID to list questions for'),
  status: z
    .enum(['all', 'unanswered', 'answered'])
    .optional()
    .describe("Filter by status. Defaults to 'all'."),
};

export async function listTaskQuestions(args: { taskId: string; status?: 'all' | 'unanswered' | 'answered' }) {
  const db = getDb();
  const status = args.status ?? 'all';

  const taskDoc = await db.collection('tasks').doc(args.taskId).get();
  if (!taskDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
      isError: true,
    };
  }
  const taskName = (taskDoc.data()?.name as string) || args.taskId;

  const snap = await db.collection('taskQuestions').where('taskId', '==', args.taskId).get();
  type QDoc = {
    id: string;
    question?: string;
    answer?: string | null;
    askedBy?: string;
    askedAt?: FirebaseFirestore.Timestamp;
  };
  let docs: QDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<QDoc, 'id'>) }));

  if (status === 'unanswered') docs = docs.filter((d) => d.answer === null || d.answer === undefined);
  if (status === 'answered') docs = docs.filter((d) => d.answer !== null && d.answer !== undefined);

  // Sort by askedAt asc
  docs.sort((a, b) => {
    const at = a.askedAt?.toMillis?.() ?? 0;
    const bt = b.askedAt?.toMillis?.() ?? 0;
    return at - bt;
  });

  if (docs.length === 0) {
    return {
      content: [{ type: 'text' as const, text: `No ${status === 'all' ? '' : status + ' '}questions on task **${taskName}**.` }],
    };
  }

  const lines: string[] = [];
  lines.push(`Questions on task **${taskName}** (${docs.length}):`);
  lines.push('');
  for (const d of docs) {
    const answered = d.answer !== null && d.answer !== undefined;
    const askedAt = d.askedAt?.toDate?.().toISOString().split('T')[0] ?? '';
    lines.push(`### ${answered ? '✅' : '❓'} ${d.question ?? ''}`);
    lines.push(`*ID: \`${d.id}\` · asked by ${d.askedBy ?? 'unknown'}${askedAt ? ` on ${askedAt}` : ''}*`);
    if (answered) {
      lines.push('');
      lines.push(`**Answer:** ${d.answer}`);
    } else {
      lines.push('*(unanswered)*');
    }
    lines.push('');
  }

  return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
}
