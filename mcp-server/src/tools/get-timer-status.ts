import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration, formatTime, elapsedMinutes } from '../lib/formatting.js';

export async function getTimerStatus() {
  const db = getDb();

  const activeQuery = await db.collection('timeEntries')
    .where('endTime', '==', null)
    .orderBy('startTime', 'desc')
    .get();

  if (activeQuery.empty) {
    return {
      content: [{ type: 'text' as const, text: 'No active timer running.' }],
    };
  }

  const doc = activeQuery.docs[0];
  const data = doc.data();
  const elapsed = elapsedMinutes(data.startTime as Timestamp);

  // Get project name
  const projectDoc = await db.collection('projects').doc(data.projectId).get();
  const projectName = projectDoc.data()?.name || data.projectId;

  // Get task name
  let taskInfo = '';
  if (data.taskId) {
    const taskDoc = await db.collection('tasks').doc(data.taskId).get();
    if (taskDoc.exists) {
      taskInfo = `\n- Task: **${taskDoc.data()?.name}**`;
    }
  }

  const notesInfo = data.notes ? `\n- Notes: ${data.notes}` : '';

  return {
    content: [{
      type: 'text' as const,
      text: `Timer is running.\n\n- Project: **${projectName}**${taskInfo}\n- Started: ${formatTime(data.startTime as Timestamp)}\n- Elapsed: **${formatDuration(elapsed)}**${notesInfo}\n- Entry ID: \`${doc.id}\``,
    }],
  };
}
