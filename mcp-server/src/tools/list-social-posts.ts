import { z } from 'zod';
import { getDb } from '../firebase.js';
import { tsMs, fmtCairo, statusIcon, resolveProjectNames, ok, fail, type Plat } from '../lib/social-posts.js';

export const listSocialPostsSchema = {
  projectId: z.string().optional().describe('Filter to one project (omit to list across all projects)'),
  status: z.enum(['draft', 'scheduled', 'publishing', 'published', 'failed', 'all']).optional().describe('Filter by status'),
  platform: z.enum(['fb', 'ig', 'all']).optional().describe('Filter by platform'),
  limit: z.number().optional().describe('Max rows (default 30)'),
};

export async function listSocialPosts(args: {
  projectId?: string; status?: string; platform?: 'fb' | 'ig' | 'all'; limit?: number;
}) {
  try {
    const db = getDb();
    let q: FirebaseFirestore.Query = db.collection('socialPosts');
    if (args.projectId) q = q.where('projectId', '==', args.projectId);
    const snap = await q.get();

    let posts = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    if (args.status && args.status !== 'all') posts = posts.filter((p) => p.status === args.status);
    if (args.platform && args.platform !== 'all') posts = posts.filter((p) => (p.platforms as Plat[] | undefined)?.includes(args.platform as Plat));
    posts.sort((a, b) => (tsMs(b.scheduledAt ?? b.createdAt) - tsMs(a.scheduledAt ?? a.createdAt)));

    if (posts.length === 0) return ok('No social posts match those filters.');

    const limit = args.limit ?? 30;
    const shown = posts.slice(0, limit);
    const names = await resolveProjectNames(db, [...new Set(shown.map((p) => p.projectId))]);
    const rows = shown.map((p) => {
      const when = p.scheduledAt ? fmtCairo(tsMs(p.scheduledAt)) : (p.publishedAt ? fmtCairo(tsMs(p.publishedAt)) : '—');
      const capRaw = (p.caption || '').replace(/\s+/g, ' ').trim();
      const cap = capRaw.slice(0, 40) + (capRaw.length > 40 ? '…' : '');
      const flag = p.status === 'failed' && p.error ? ` (${String(p.error).slice(0, 40)})` : '';
      return `| ${names[p.projectId] || p.projectId} | ${statusIcon(p.status)} ${p.status}${flag} | ${(p.platforms || []).join('+')} | ${when} | ${cap} | \`${p.id}\` |`;
    });
    const header =
      `Showing ${shown.length}${posts.length > limit ? ` of ${posts.length}` : ''} post(s) ` +
      `— 📝 draft · ⏳ scheduled · ⏫ publishing · ✅ published · ⚠️ failed\n\n` +
      `| Project | Status | Platforms | When (Cairo) | Caption | ID |\n|---|---|---|---|---|---|\n`;
    return ok(header + rows.join('\n'));
  } catch (e) {
    return fail((e as Error).message);
  }
}
