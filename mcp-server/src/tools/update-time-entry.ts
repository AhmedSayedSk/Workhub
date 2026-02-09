import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { parseDuration } from '../lib/duration.js';
import { formatDuration, formatTime } from '../lib/formatting.js';

export const updateTimeEntrySchema = {
  entryId: z.string().describe('The time entry ID to update'),
  duration: z.string().optional().describe('New duration (e.g. "2h 30m", "90m", "1.5h")'),
  notes: z.string().optional().describe('New notes (replaces existing notes)'),
  projectId: z.string().optional().describe('Move entry to a different project'),
  taskId: z.string().optional().describe('Change the linked task'),
};

export async function updateTimeEntry(args: {
  entryId: string;
  duration?: string;
  notes?: string;
  projectId?: string;
  taskId?: string;
}) {
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
  const updates: Record<string, unknown> = {};

  // Update duration — adjust endTime accordingly
  if (args.duration) {
    let minutes: number;
    try {
      minutes = parseDuration(args.duration);
    } catch (e) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }],
        isError: true,
      };
    }
    updates.duration = minutes;
    const startMs = (data.startTime as Timestamp).toMillis();
    updates.endTime = Timestamp.fromMillis(startMs + minutes * 60000);
  }

  if (args.notes !== undefined) {
    updates.notes = args.notes;
  }

  if (args.projectId) {
    const projectDoc = await db.collection('projects').doc(args.projectId).get();
    if (!projectDoc.exists) {
      return {
        content: [{ type: 'text' as const, text: `Project \`${args.projectId}\` not found.` }],
        isError: true,
      };
    }
    updates.projectId = args.projectId;
  }

  if (args.taskId !== undefined) {
    updates.taskId = args.taskId;
  }

  if (Object.keys(updates).length === 0) {
    return {
      content: [{ type: 'text' as const, text: 'No fields to update. Provide at least one field to change.' }],
      isError: true,
    };
  }

  await entryRef.update(updates);

  // Read back updated entry for display
  const updatedDoc = await entryRef.get();
  const updated = updatedDoc.data()!;
  const projectDoc = await db.collection('projects').doc(updated.projectId).get();
  const projectName = projectDoc.data()?.name || updated.projectId;
  const duration = updated.duration as number;
  const startTime = formatTime(updated.startTime as Timestamp);
  const endTime = updated.endTime ? formatTime(updated.endTime as Timestamp) : 'now';
  const changedFields = Object.keys(updates).join(', ');

  return {
    content: [{
      type: 'text' as const,
      text: `Time entry updated (${changedFields}):\n\n- **${formatDuration(duration)}** on **${projectName}** (${startTime} → ${endTime})\n- ID: \`${args.entryId}\``,
    }],
  };
}
