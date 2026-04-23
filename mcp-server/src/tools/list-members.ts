import { z } from 'zod';
import { getDb } from '../firebase.js';

export const listMembersSchema = {
  search: z.string().optional().describe('Filter members by name, email, or role (case-insensitive substring match)'),
};

export async function listMembers(args: { search?: string }) {
  try {
    const db = getDb();
    const snapshot = await db.collection('members').get();

    let members = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: (data.name || '') as string,
        role: (data.role || '') as string,
        email: (data.email || '') as string,
      };
    });

    if (args.search) {
      const q = args.search.toLowerCase();
      members = members.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q),
      );
    }

    if (members.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No members found matching the criteria.' }] };
    }

    const lines = members.map(
      (m) => `- **${m.name}** — ${m.role || 'no role'} — ${m.email || 'no email'} — ID: \`${m.id}\``,
    );

    return {
      content: [{
        type: 'text' as const,
        text: `Found ${members.length} member(s):\n\n${lines.join('\n')}`,
      }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}
