import { z } from 'zod';
import { getDb } from '../firebase.js';

export const listTasksSchema = {
  projectId: z.string().describe('The project ID to list tasks for'),
  status: z.enum(['todo', 'in_progress', 'review', 'done']).optional().describe('Filter by task status'),
  search: z.string().optional().describe('Filter tasks by name (case-insensitive substring match)'),
};

export async function listTasks(args: { projectId: string; status?: string; search?: string }) {
  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection('tasks')
    .where('projectId', '==', args.projectId)
    .orderBy('createdAt', 'desc');

  if (args.status) {
    query = db.collection('tasks')
      .where('projectId', '==', args.projectId)
      .where('status', '==', args.status)
      .orderBy('createdAt', 'desc');
  }

  const snapshot = await query.get();
  let tasks = snapshot.docs.map(doc => ({
    id: doc.id,
    name: doc.data().name as string,
    status: doc.data().status as string,
    priority: doc.data().priority as string,
    taskType: doc.data().taskType as string,
    estimatedHours: doc.data().estimatedHours as number,
    actualHours: doc.data().actualHours as number,
  }));

  if (args.search) {
    const search = args.search.toLowerCase();
    tasks = tasks.filter(t => t.name.toLowerCase().includes(search));
  }

  if (tasks.length === 0) {
    return { content: [{ type: 'text' as const, text: 'No tasks found matching the criteria.' }] };
  }

  const lines = tasks.map(t => {
    const est = t.estimatedHours ? ` (est: ${t.estimatedHours}h)` : '';
    return `- [${t.status}] **${t.name}** — ${t.taskType}, ${t.priority} priority${est} — ID: \`${t.id}\``;
  });

  return {
    content: [{
      type: 'text' as const,
      text: `Found ${tasks.length} task(s):\n\n${lines.join('\n')}`,
    }],
  };
}
