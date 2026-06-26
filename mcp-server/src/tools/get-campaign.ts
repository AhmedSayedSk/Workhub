import { z } from 'zod';
import { getDb } from '../firebase.js';
import { tsMs, fmtCairo, ok, fail } from '../lib/social-posts.js';

export const getCampaignSchema = {
  campaignId: z.string().describe('The campaign ID'),
};

export async function getCampaign(args: { campaignId: string }) {
  try {
    const db = getDb();
    const snap = await db.collection('campaigns').doc(args.campaignId).get();
    if (!snap.exists) return fail(`Campaign \`${args.campaignId}\` not found.`);
    const c = snap.data() as any;

    const postsSnap = await db.collection('campaignPosts').where('campaignId', '==', args.campaignId).get();
    const posts = postsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    posts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const platforms = (c.platforms || []).join(' + ') || '—';
    const goal = c.brief?.goal || '—';
    const header =
      `**${c.name || '(unnamed)'}** \`${args.campaignId}\`\n` +
      `Status: ${c.status || 'draft'} · Language: ${c.language || '—'} · Platforms: ${platforms}\n` +
      `Goal: ${goal}\n`;

    if (posts.length === 0) return ok(`${header}\nNo posts yet.`);

    const rows = posts.map((p) => {
      const capRaw = (p.caption || '').replace(/\s+/g, ' ').trim();
      const cap = capRaw.slice(0, 120) + (capRaw.length > 120 ? '…' : '');
      const tags = (p.hashtags || []).map((h: string) => '#' + h).join(' ') || '—';
      const img = p.imageUrl ? 'yes' : 'no';
      const when = p.scheduledAt ? fmtCairo(tsMs(p.scheduledAt)) : '—';
      return `#${(p.order ?? 0) + 1} [${p.status || 'planned'}] ${cap} | ${tags} | image: ${img} | scheduledAt: ${when} | postId=${p.id}`;
    });
    return ok(`${header}\n${posts.length} post(s):\n\n${rows.join('\n')}`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
