import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { ok, fail } from '../lib/social-posts.js';

export const updateCampaignPostSchema = {
  postId: z.string().describe('The campaign post ID'),
  caption: z.string().optional().describe('New caption'),
  hashtags: z.array(z.string()).optional().describe('New hashtags (without leading #)'),
  imagePrompt: z.string().optional().describe('New image prompt'),
  status: z.enum(['planned', 'approved', 'ready']).optional().describe('New status'),
};

export async function updateCampaignPost(args: {
  postId: string; caption?: string; hashtags?: string[]; imagePrompt?: string;
  status?: 'planned' | 'approved' | 'ready';
}) {
  try {
    const db = getDb();
    const ref = db.collection('campaignPosts').doc(args.postId);
    const snap = await ref.get();
    if (!snap.exists) return fail(`Campaign post \`${args.postId}\` not found.`);
    const cur = snap.data() as any;

    if (cur.status === 'scheduled') {
      return fail(`Post \`${args.postId}\` is already scheduled — edit the live post via update_social_post using its socialPostId \`${cur.socialPostId || '?'}\`.`);
    }

    const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
    const changed: string[] = [];
    if (args.caption !== undefined) { patch.caption = args.caption; changed.push('caption'); }
    if (args.hashtags !== undefined) { patch.hashtags = args.hashtags; changed.push('hashtags'); }
    if (args.imagePrompt !== undefined) { patch.imagePrompt = args.imagePrompt; changed.push('imagePrompt'); }
    if (args.status !== undefined) { patch.status = args.status; changed.push(`status=${args.status}`); }

    await ref.update(patch);
    return ok(`Updated campaign post \`${args.postId}\`${changed.length ? ` — ${changed.join(', ')}` : ' (no fields)'}.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
