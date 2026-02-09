import { z } from 'zod';
import { getDb } from '../firebase.js';

export const listProjectsSchema = {
  search: z.string().optional().describe('Filter projects by name (case-insensitive substring match)'),
  status: z.enum(['active', 'paused', 'completed', 'cancelled']).optional().describe('Filter by project status'),
};

export async function listProjects(args: { search?: string; status?: string }) {
  try {
    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection('projects');

    if (args.status) {
      query = query.where('status', '==', args.status);
    }

    const snapshot = await query.get();
    let projects = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: (data.name || '') as string,
        status: (data.status || '') as string,
        clientName: (data.clientName || '') as string,
        systemId: (data.systemId || '') as string,
      };
    });

    if (args.search) {
      const search = args.search.toLowerCase();
      projects = projects.filter(p => p.name.toLowerCase().includes(search));
    }

    if (projects.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No projects found matching the criteria.' }] };
    }

    const lines = projects.map(p => `- **${p.name}** (${p.status}) — ID: \`${p.id}\``);
    return {
      content: [{
        type: 'text' as const,
        text: `Found ${projects.length} project(s):\n\n${lines.join('\n')}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
