import { z } from 'zod';
import { loadCampaigns, readPosts, lastLog, cronLines, fmtCairo, type NormPost, type PlatStatus } from '../lib/social-scheduler.js';

export const schedulerStatusSchema = {
  // Key from the operator's private campaign config — not enumerated here
  // because this repo is public. 'all' (or omitted) covers every campaign.
  campaign: z.string().optional().describe("Which campaign, or 'all' (default: all)"),
};

function tally(posts: NormPost[], side: 'fb' | 'ig'): Record<PlatStatus, number> {
  const t: Record<PlatStatus, number> = { published: 0, scheduled: 0, pending: 0, due: 0, missed: 0, 'n/a': 0 };
  for (const p of posts) t[p[side].status]++;
  return t;
}

export async function schedulerStatus(args: { campaign?: string }) {
  try {
    let cs = loadCampaigns();
    if (args.campaign && args.campaign !== 'all') cs = cs.filter((c) => c.key === args.campaign);
    if (cs.length === 0) return { content: [{ type: 'text' as const, text: 'No campaigns configured.' }] };

    const cron = await cronLines();
    const blocks: string[] = [];
    for (const c of cs) {
      let posts: NormPost[];
      try { posts = readPosts(c).sort((a, b) => a.datetime.getTime() - b.datetime.getTime()); }
      catch (e) { blocks.push(`### ${c.name}\n⚠️ could not read schedule: ${(e as Error).message}`); continue; }

      const fb = tally(posts, 'fb'), ig = tally(posts, 'ig');
      const next = posts.find((p) => p.datetime.getTime() > Date.now());
      const ll = lastLog(c);
      const cronOn = cron.some((l) => l.includes(c.dir) && !l.trim().startsWith('#'));
      const fbLine = `✅ ${fb.published} · ⏳ ${fb.scheduled} · ◻️ ${fb.pending}${fb.missed ? ` · ⚠️ ${fb.missed} missed` : ''}`;
      const igLine = `✅ ${ig.published} · ◻️ ${ig.pending}${ig.due ? ` · 🔵 ${ig.due} due` : ''}`;
      blocks.push(
        `### ${c.name}  (${posts.length} posts)\n` +
        `- **Facebook:** ${fbLine}\n` +
        `- **Instagram:** ${igLine}\n` +
        `- **Next up:** ${next ? `${fmtCairo(next.datetime)} — \`${next.key}\`` : '— (none upcoming)'}\n` +
        `- **Cron:** ${cronOn ? '🟢 active' : '🔴 not found'}\n` +
        `- **Last run:** ${ll.mtime ? ll.mtime.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : '—'}` +
        (ll.line ? `\n  ↳ ${ll.line}` : ''),
      );
    }
    return { content: [{ type: 'text' as const, text: `## Social scheduler status\n\n${blocks.join('\n\n')}` }] };
  } catch (error) {
    return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
  }
}
