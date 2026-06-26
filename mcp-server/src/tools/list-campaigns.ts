import { z } from 'zod';
import { getDb } from '../firebase.js';
import { tsMs, resolveProjectNames, ok, fail } from '../lib/social-posts.js';

export const listCampaignsSchema = {
  projectId: z.string().optional().describe('Filter to one project (omit to list across all projects)'),
};

export async function listCampaigns(args: { projectId?: string }) {
  try {
    const db = getDb();
    let q: FirebaseFirestore.Query = db.collection('campaigns');
    if (args.projectId) q = q.where('projectId', '==', args.projectId);
    const snap = await q.get();

    let campaigns = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    campaigns.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));

    if (campaigns.length === 0) return ok('No campaigns match those filters.');

    const postsSnap = await db.collection('campaignPosts').get();
    const counts: Record<string, { total: number; scheduled: number }> = {};
    postsSnap.docs.forEach((d) => {
      const p = d.data() as any;
      const cid = p.campaignId as string;
      if (!cid) return;
      if (!counts[cid]) counts[cid] = { total: 0, scheduled: 0 };
      counts[cid].total += 1;
      if (p.status === 'scheduled') counts[cid].scheduled += 1;
    });

    const names = await resolveProjectNames(db, [...new Set(campaigns.map((c) => c.projectId))]);
    const rows = campaigns.map((c) => {
      const cnt = counts[c.id] || { total: 0, scheduled: 0 };
      return `• ${c.name || '(unnamed)'} \`${c.id}\` — ${names[c.projectId] || c.projectId} — ${c.status || 'draft'} (${cnt.total} posts, ${cnt.scheduled} scheduled)`;
    });
    return ok(`${campaigns.length} campaign(s):\n\n${rows.join('\n')}`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
