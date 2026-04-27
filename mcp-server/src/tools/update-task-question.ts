import { z } from 'zod';
import { getDb } from '../firebase.js';

export const updateTaskQuestionSchema = {
  questionId: z.string().describe('The question ID to update'),
  question: z.string().min(1).describe('The new question text'),
};

export async function updateTaskQuestion(args: { questionId: string; question: string }) {
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
        text: `Error: Question \`${args.questionId}\` has already been answered and is locked. Add a new question instead.`,
      }],
      isError: true,
    };
  }

  await ref.update({ question: args.question });

  return {
    content: [{
      type: 'text' as const,
      text: `Question \`${args.questionId}\` updated.`,
    }],
  };
}
