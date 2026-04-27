import { z } from 'zod';
import { getDb } from '../firebase.js';

export const deleteTaskQuestionSchema = {
  questionId: z.string().describe('The question ID to delete'),
};

export async function deleteTaskQuestion(args: { questionId: string }) {
  const db = getDb();

  const ref = db.collection('taskQuestions').doc(args.questionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Question with ID \`${args.questionId}\` not found.` }],
      isError: true,
    };
  }
  const data = snap.data()!;
  if (data.answer !== null && data.answer !== undefined) {
    return {
      content: [{
        type: 'text' as const,
        text: `Error: Question \`${args.questionId}\` has already been answered and is locked. Answered questions cannot be deleted from the audit trail.`,
      }],
      isError: true,
    };
  }

  await ref.delete();

  return {
    content: [{
      type: 'text' as const,
      text: `Question \`${args.questionId}\` deleted.`,
    }],
  };
}
