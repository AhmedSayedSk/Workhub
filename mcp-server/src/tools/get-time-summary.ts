import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { formatDuration } from '../lib/formatting.js';

export const getTimeSummarySchema = {
  period: z.enum(['today', 'week', 'month']).optional().default('today').describe('Time period: today, week, or month'),
  projectId: z.string().optional().describe('Filter to a specific project ID'),
};

function getDateRange(period: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  // Set end to end of today
  end.setHours(23, 59, 59, 999);

  switch (period) {
    case 'week': {
      const dayOfWeek = start.getDay();
      // Start from Monday (adjust Sunday = 0 to be 7)
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'This week' };
    }
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'This month' };
    default: // today
      start.setHours(0, 0, 0, 0);
      return { start, end, label: 'Today' };
  }
}

export async function getTimeSummary(args: { period?: string; projectId?: string }) {
  const db = getDb();
  const period = args.period || 'today';
  const { start, end, label } = getDateRange(period);

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
  const entries = snapshot.docs.map(doc => doc.data());

  if (entries.length === 0) {
    return {
      content: [{ type: 'text' as const, text: `${label}: No time entries found.` }],
    };
  }

  // Aggregate by project
  const byProject: Record<string, { minutes: number; entries: number }> = {};
  let totalMinutes = 0;

  for (const entry of entries) {
    const pid = entry.projectId as string;
    if (!byProject[pid]) {
      byProject[pid] = { minutes: 0, entries: 0 };
    }

    // For active timers (endTime=null), calculate elapsed
    let duration: number;
    if (entry.endTime === null) {
      const startMs = (entry.startTime as Timestamp).toMillis();
      duration = Math.max(1, Math.round((Date.now() - startMs) / 60000));
    } else {
      duration = (entry.duration as number) || 0;
    }

    byProject[pid].minutes += duration;
    byProject[pid].entries += 1;
    totalMinutes += duration;
  }

  // Fetch project names
  const projectIds = Object.keys(byProject);
  const projectNames: Record<string, string> = {};
  for (const pid of projectIds) {
    const projectDoc = await db.collection('projects').doc(pid).get();
    projectNames[pid] = projectDoc.data()?.name || pid;
  }

  // Build summary
  const lines: string[] = [];
  lines.push(`**${label}** — ${formatDuration(totalMinutes)} total (${entries.length} entries)\n`);

  // Sort projects by time descending
  const sorted = Object.entries(byProject).sort((a, b) => b[1].minutes - a[1].minutes);

  for (const [pid, stats] of sorted) {
    lines.push(`- **${projectNames[pid]}**: ${formatDuration(stats.minutes)} (${stats.entries} entries)`);
  }

  return {
    content: [{ type: 'text' as const, text: lines.join('\n') }],
  };
}
