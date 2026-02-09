import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration, formatTime, formatDate } from '../lib/formatting.js';

export const listTimeEntriesSchema = {
  projectId: z.string().optional().describe('Filter to a specific project ID'),
  date: z.string().optional().describe('Filter by date in YYYY-MM-DD format (defaults to today)'),
  limit: z.number().optional().describe('Max entries to return (default: 20)'),
};

export async function listTimeEntries(args: { projectId?: string; date?: string; limit?: number }) {
  const db = getDb();
  const maxEntries = args.limit || 20;

  // Determine date range
  let start: Date;
  let end: Date;
  if (args.date) {
    start = new Date(`${args.date}T00:00:00`);
    if (isNaN(start.getTime())) {
      return {
        content: [{ type: 'text' as const, text: `Error: Invalid date format "${args.date}". Use YYYY-MM-DD.` }],
        isError: true,
      };
    }
    end = new Date(`${args.date}T23:59:59.999`);
  } else {
    start = new Date();
    start.setHours(0, 0, 0, 0);
    end = new Date();
    end.setHours(23, 59, 59, 999);
  }

  let query: FirebaseFirestore.Query = db.collection('timeEntries')
    .where('startTime', '>=', Timestamp.fromDate(start))
    .where('startTime', '<=', Timestamp.fromDate(end))
    .orderBy('startTime', 'desc');

  if (args.projectId) {
    query = db.collection('timeEntries')
      .where('projectId', '==', args.projectId)
      .where('startTime', '>=', Timestamp.fromDate(start))
      .where('startTime', '<=', Timestamp.fromDate(end))
      .orderBy('startTime', 'desc');
  }

  const snapshot = await query.get();

  if (snapshot.empty) {
    const dateLabel = args.date || start.toISOString().split('T')[0];
    return {
      content: [{ type: 'text' as const, text: `No time entries found for ${dateLabel}.` }],
    };
  }

  // Fetch project names
  const projectIds = [...new Set(snapshot.docs.map(d => d.data().projectId as string))];
  const projectNames: Record<string, string> = {};
  for (const pid of projectIds) {
    const projectDoc = await db.collection('projects').doc(pid).get();
    projectNames[pid] = projectDoc.data()?.name || pid;
  }

  const entries = snapshot.docs.slice(0, maxEntries).map(doc => {
    const data = doc.data();
    const startTime = data.startTime as Timestamp;
    const endTime = data.endTime as Timestamp | null;
    const duration = endTime === null
      ? Math.max(1, Math.round((Date.now() - startTime.toMillis()) / 60000))
      : (data.duration as number) || 0;
    const isActive = endTime === null;
    const notes = data.notes ? ` — "${data.notes}"` : '';
    const activeTag = isActive ? ' **(active)**' : '';
    const timeRange = isActive
      ? `${formatTime(startTime)} → now`
      : `${formatTime(startTime)} → ${formatTime(endTime!)}`;

    return `- ${formatDuration(duration)} on **${projectNames[data.projectId]}** (${timeRange})${activeTag}${notes}\n  ID: \`${doc.id}\``;
  });

  const dateLabel = args.date || start.toISOString().split('T')[0];

  return {
    content: [{
      type: 'text' as const,
      text: `**${dateLabel}** — ${snapshot.size} entries:\n\n${entries.join('\n')}`,
    }],
  };
}
