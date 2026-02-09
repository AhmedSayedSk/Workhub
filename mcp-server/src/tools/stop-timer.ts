import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration, formatTime, elapsedMinutes } from '../lib/formatting.js';

export const stopTimerSchema = {
  notes: z.string().optional().describe('Additional notes to append to the time entry'),
};

export async function stopTimer(args: { notes?: string }) {
  const db = getDb();
  const timeEntriesRef = db.collection('timeEntries');

  // Find active timer
  const activeQuery = await timeEntriesRef
    .where('endTime', '==', null)
    .orderBy('startTime', 'desc')
    .get();

  if (activeQuery.empty) {
    return {
      content: [{ type: 'text' as const, text: 'No active timer running.' }],
    };
  }

  const activeDoc = activeQuery.docs[0];
  const activeData = activeDoc.data();
  const now = Timestamp.now();
  const elapsed = elapsedMinutes(activeData.startTime as Timestamp);
  const duration = Math.max(1, elapsed);

  // Update the entry
  const updateData: Record<string, unknown> = {
    endTime: now,
    duration,
  };

  if (args.notes) {
    const existingNotes = activeData.notes || '';
    updateData.notes = existingNotes ? `${existingNotes}\n${args.notes}` : args.notes;
  }

  await activeDoc.ref.update(updateData);

  // Get project/task names for display
  const projectDoc = await db.collection('projects').doc(activeData.projectId).get();
  const projectName = projectDoc.data()?.name || activeData.projectId;

  let taskInfo = '';
  if (activeData.taskId) {
    const taskDoc = await db.collection('tasks').doc(activeData.taskId).get();
    if (taskDoc.exists) {
      taskInfo = ` / task: **${taskDoc.data()?.name}**`;
    }
  }

  const startTimeStr = formatTime(activeData.startTime as Timestamp);
  const endTimeStr = formatTime(now);

  return {
    content: [{
      type: 'text' as const,
      text: `Timer stopped.\n\n**${projectName}**${taskInfo}\n- Duration: **${formatDuration(duration)}**\n- ${startTimeStr} → ${endTimeStr}\n- Entry ID: \`${activeDoc.id}\``,
    }],
  };
}
