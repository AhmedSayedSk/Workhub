import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration, formatTime, elapsedMinutes } from '../lib/formatting.js';

export const startTimerSchema = {
  projectId: z.string().describe('The project ID to track time for'),
  taskId: z.string().optional().describe('The task ID (optional)'),
  subtaskId: z.string().optional().describe('The subtask ID (optional)'),
  notes: z.string().optional().describe('Notes for this time entry'),
};

export async function startTimer(args: {
  projectId: string;
  taskId?: string;
  subtaskId?: string;
  notes?: string;
}) {
  const db = getDb();
  const timeEntriesRef = db.collection('timeEntries');
  const messages: string[] = [];

  // Validate project exists
  const projectDoc = await db.collection('projects').doc(args.projectId).get();
  if (!projectDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Project with ID \`${args.projectId}\` not found.` }],
      isError: true,
    };
  }
  const projectName = projectDoc.data()?.name;

  // Validate task if provided
  let taskName = '';
  if (args.taskId) {
    const taskDoc = await db.collection('tasks').doc(args.taskId).get();
    if (!taskDoc.exists) {
      return {
        content: [{ type: 'text' as const, text: `Error: Task with ID \`${args.taskId}\` not found.` }],
        isError: true,
      };
    }
    taskName = taskDoc.data()?.name;
  }

  // Auto-stop any active timer
  const activeQuery = await timeEntriesRef
    .where('endTime', '==', null)
    .orderBy('startTime', 'desc')
    .get();

  if (!activeQuery.empty) {
    const activeDoc = activeQuery.docs[0];
    const activeData = activeDoc.data();
    const now = Timestamp.now();
    const elapsed = elapsedMinutes(activeData.startTime as Timestamp);
    const duration = Math.max(1, elapsed);

    await activeDoc.ref.update({
      endTime: now,
      duration,
    });

    // Get the project name of the stopped timer
    const stoppedProjectDoc = await db.collection('projects').doc(activeData.projectId).get();
    const stoppedProjectName = stoppedProjectDoc.data()?.name || activeData.projectId;

    messages.push(`Auto-stopped previous timer on **${stoppedProjectName}** (${formatDuration(duration)}).`);
  }

  // Create new time entry with endTime=null
  const now = Timestamp.now();
  const newEntry = {
    projectId: args.projectId,
    taskId: args.taskId || '',
    subtaskId: args.subtaskId || '',
    startTime: now,
    endTime: null,
    duration: 0,
    notes: args.notes || '',
    isManual: false,
    createdAt: now,
  };

  const docRef = await timeEntriesRef.add(newEntry);

  const taskInfo = taskName ? ` / task: **${taskName}**` : '';
  messages.push(`Timer started on **${projectName}**${taskInfo} at ${formatTime(now)}.`);
  messages.push(`Entry ID: \`${docRef.id}\``);

  return {
    content: [{ type: 'text' as const, text: messages.join('\n\n') }],
  };
}
