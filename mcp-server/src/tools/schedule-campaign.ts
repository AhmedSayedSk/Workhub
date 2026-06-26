import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { fmtCairo, ok, fail } from '../lib/social-posts.js';

export const scheduleCampaignSchema = {
  campaignId: z.string().describe('The campaign ID to schedule'),
};

export async function scheduleCampaign(args: { campaignId: string }) {
  try {
    const db = getDb();
    const campRef = db.collection('campaigns').doc(args.campaignId);
    const campSnap = await campRef.get();
    if (!campSnap.exists) return fail(`Campaign \`${args.campaignId}\` not found.`);
    const campaign = campSnap.data() as any;
    const brief = campaign.brief || {};

    const postsSnap = await db.collection('campaignPosts').where('campaignId', '==', args.campaignId).get();
    const posts = postsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    posts.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const eligible = posts.filter((p) => p.imageUrl && p.status !== 'scheduled');
    let scheduledCount = 0;
    const slots: number[] = [];

    for (const post of eligible) {
      const order = post.order ?? 0;
      const base = Math.max(
        new Date(`${brief.startDate}T${brief.postTime || '18:00'}:00`).getTime() || (Date.now() + 300000),
        Date.now() + 300000
      );
      const slot = base + order * Math.max(1, brief.cadenceDays || 1) * 86400000;

      const caption = (post.caption || '') +
        ((post.hashtags && post.hashtags.length) ? '\n\n' + post.hashtags.map((h: string) => '#' + h).join(' ') : '');

      const ref = await db.collection('socialPosts').add({
        projectId: campaign.projectId,
        platforms: campaign.platforms,
        caption,
        mediaUrls: [post.imageUrl],
        mediaType: 'image',
        status: 'scheduled',
        scheduledAt: Timestamp.fromMillis(slot),
        publishedAt: null,
        fbPostId: null,
        igMediaId: null,
        error: null,
        attempts: 0,
        createdBy: 'mcp',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      await db.collection('campaignPosts').doc(post.id).update({
        status: 'scheduled',
        socialPostId: ref.id,
        scheduledAt: Timestamp.fromMillis(slot),
        updatedAt: Timestamp.now(),
      });

      slots.push(slot);
      scheduledCount += 1;
    }

    // A "ready" post = has an imageUrl. The campaign is fully scheduled when no post with an
    // imageUrl is still unscheduled. Posts without an image can't be scheduled yet → not fully scheduled.
    const allScheduled = !posts.some((p) => !p.imageUrl);

    await campRef.update({
      status: allScheduled ? 'scheduled' : 'ready',
      updatedAt: Timestamp.now(),
    });

    if (scheduledCount === 0) {
      return ok('No eligible posts to schedule (need an imageUrl and not already scheduled).');
    }

    slots.sort((a, b) => a - b);
    const first = fmtCairo(slots[0]);
    const last = fmtCairo(slots[slots.length - 1]);
    const range = slots.length > 1 ? `${first} → ${last}` : first;
    return ok(`Scheduled ${scheduledCount} post(s) — ${range} (Cairo). Campaign status: ${allScheduled ? 'scheduled' : 'ready'}.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
