import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration, formatTime } from '../lib/formatting.js';

export const deleteTimeEntrySchema = {
  entryId: z.string().describe('The time entry ID to delete'),
};

export async function deleteTimeEntry(args: { entryId: string }) {
  const db = getDb();

  const entryRef = db.collection('timeEntries').doc(args.entryId);
  const entryDoc = await entryRef.get();

  if (!entryDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Time entry \`${args.entryId}\` not found.` }],
      isError: true,
    };
  }

  const data = entryDoc.data()!;

  // Get project name for confirmation message
  const projectDoc = await db.collection('projects').doc(data.projectId).get();
  const projectName = projectDoc.data()?.name || data.projectId;
  const duration = data.duration as number || 0;
  const startTime = formatTime(data.startTime as Timestamp);
  const notes = data.notes ? ` — "${data.notes}"` : '';

  await entryRef.delete();

  return {
    content: [{
      type: 'text' as const,
      text: `Deleted time entry:\n\n- **${formatDuration(duration)}** on **${projectName}** (${startTime})${notes}\n- ID: \`${args.entryId}\``,
    }],
  };
}
