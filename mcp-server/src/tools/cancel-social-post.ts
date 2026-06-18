import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { ok, fail } from '../lib/social-posts.js';

export const cancelSocialPostSchema = {
  id: z.string().describe('The social post ID'),
  hardDelete: z.boolean().optional().describe('Permanently delete instead of moving it back to draft (default false)'),
};

export async function cancelSocialPost(args: { id: string; hardDelete?: boolean }) {
  try {
    const db = getDb();
    const ref = db.collection('socialPosts').doc(args.id);
    const snap = await ref.get();
    if (!snap.exists) return fail(`Social post \`${args.id}\` not found.`);
    const cur = snap.data() as any;
    if (cur.status === 'published') return fail('That post is already published — it cannot be unscheduled here.');

    if (args.hardDelete) {
      await ref.delete();
      return ok(`Deleted social post \`${args.id}\`.`);
    }
    await ref.update({ status: 'draft', scheduledAt: null, updatedAt: Timestamp.now() });
    return ok(`Unscheduled social post \`${args.id}\` — moved back to draft.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
