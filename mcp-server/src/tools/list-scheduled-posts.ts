import { z } from 'zod';
import { allPosts, fmtCairo, ICON, type PlatStatus } from '../lib/social-scheduler.js';

export const listScheduledPostsSchema = {
  campaign: z.enum(['coffeepos', 'sikasio', 'all']).optional().describe('Which campaign (default: all)'),
  platform: z.enum(['facebook', 'instagram', 'all']).optional().describe('Only posts targeting this platform'),
  status: z.enum(['published', 'scheduled', 'pending', 'due', 'missed', 'all']).optional()
    .describe('Filter by FB or IG status'),
  when: z.enum(['upcoming', 'past', 'all']).optional().describe('upcoming = future slots only (default: all)'),
  limit: z.number().optional().describe('Max rows to return (default: 50)'),
};

export async function listScheduledPosts(args: {
  campaign?: 'coffeepos' | 'sikasio' | 'all';
  platform?: 'facebook' | 'instagram' | 'all';
  status?: PlatStatus | 'all';
  when?: 'upcoming' | 'past' | 'all';
  limit?: number;
}) {
  try {
    const keys = !args.campaign || args.campaign === 'all' ? undefined : [args.campaign];
    let posts = allPosts(keys);
    const now = Date.now();

    if (args.when === 'upcoming') posts = posts.filter((p) => p.datetime.getTime() > now);
    else if (args.when === 'past') posts = posts.filter((p) => p.datetime.getTime() <= now);

    if (args.platform && args.platform !== 'all') {
      posts = posts.filter((p) => (args.platform === 'facebook' ? p.fb.status : p.ig.status) !== 'n/a');
    }
    if (args.status && args.status !== 'all') {
      posts = posts.filter((p) => p.fb.status === args.status || p.ig.status === args.status);
    }

    if (posts.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No scheduled posts match those filters.' }] };
    }

    const limit = args.limit ?? 50;
    const shown = posts.slice(0, limit);
    const rows = shown.map((p) => {
      const fb = `${ICON[p.fb.status]} ${p.fb.status}`;
      const ig = `${ICON[p.ig.status]} ${p.ig.status}`;
      return `| ${p.campaign} | ${fmtCairo(p.datetime)} | \`${p.key}\` | ${fb} | ${ig} |`;
    });
    const header =
      `Showing ${shown.length}${posts.length > limit ? ` of ${posts.length}` : ''} post(s) ` +
      `— ✅ published · ⏳ scheduled · ◻️ pending · 🔵 due · ⚠️ missed\n\n` +
      `| Campaign | When (Cairo) | Post | Facebook | Instagram |\n|---|---|---|---|---|\n`;
    return { content: [{ type: 'text' as const, text: header + rows.join('\n') }] };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
  }
}
