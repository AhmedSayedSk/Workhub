import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { parseDuration } from '../lib/duration.js';
import { formatDuration } from '../lib/formatting.js';

export const logTimeSchema = {
  projectId: z.string().describe('The project ID to log time for'),
  taskId: z.string().optional().describe('The task ID (optional)'),
  subtaskId: z.string().optional().describe('The subtask ID (optional)'),
  duration: z.string().describe('Duration to log (e.g. "2h 30m", "90m", "1.5h", "1:30")'),
  notes: z.string().optional().describe('Notes for this time entry'),
  date: z.string().optional().describe('Date for the entry in YYYY-MM-DD format (defaults to today)'),
};

export async function logTime(args: {
  projectId: string;
  taskId?: string;
  subtaskId?: string;
  duration: string;
  notes?: string;
  date?: string;
}) {
  const db = getDb();

  // Validate project exists
  const projectDoc = await db.collection('projects').doc(args.projectId).get();
  if (!projectDoc.exists) {
    return {
      content: [{ type: 'text' as const, text: `Error: Project with ID \`${args.projectId}\` not found.` }],
      isError: true,
    };
  }
  const projectName = projectDoc.data()?.name;

  // Parse duration
  let minutes: number;
  try {
    minutes = parseDuration(args.duration);
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }],
      isError: true,
    };
  }

  minutes += 2;

  // Determine start/end times
  let startDate: Date;
  if (args.date) {
    startDate = new Date(`${args.date}T09:00:00`);
    if (isNaN(startDate.getTime())) {
      return {
        content: [{ type: 'text' as const, text: `Error: Invalid date format "${args.date}". Use YYYY-MM-DD.` }],
        isError: true,
      };
    }
  } else {
    startDate = new Date();
    startDate.setMinutes(startDate.getMinutes() - minutes);
  }

  const endDate = new Date(startDate.getTime() + minutes * 60000);

  const now = Timestamp.now();
  const entry = {
    projectId: args.projectId,
    taskId: args.taskId || '',
    subtaskId: args.subtaskId || '',
    startTime: Timestamp.fromDate(startDate),
    endTime: Timestamp.fromDate(endDate),
    duration: minutes,
    notes: args.notes || '',
    isManual: true,
    createdAt: now,
  };

  const docRef = await db.collection('timeEntries').add(entry);

  // Validate task if provided (for display only)
  let taskInfo = '';
  if (args.taskId) {
    const taskDoc = await db.collection('tasks').doc(args.taskId).get();
    if (taskDoc.exists) {
      taskInfo = ` / task: **${taskDoc.data()?.name}**`;
    }
  }

  return {
    content: [{
      type: 'text' as const,
      text: `Logged **${formatDuration(minutes)}** on **${projectName}**${taskInfo}.\n\n- Date: ${startDate.toISOString().split('T')[0]}\n- Entry ID: \`${docRef.id}\``,
    }],
  };
}
