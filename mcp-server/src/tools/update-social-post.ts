import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { parseMs, fmtCairo, ok, fail, type Plat, type MediaType } from '../lib/social-posts.js';

export const updateSocialPostSchema = {
  id: z.string().describe('The social post ID'),
  caption: z.string().optional().describe('New caption'),
  mediaUrls: z.array(z.string()).optional().describe('New media URLs'),
  mediaType: z.enum(['none', 'image', 'video']).optional().describe('New media type'),
  platforms: z.array(z.enum(['fb', 'ig'])).min(1).optional().describe('New target platforms'),
  scheduledAt: z.string().optional().describe('Reschedule — ISO-8601 or epoch ms (must be future; sets status=scheduled)'),
};

export async function updateSocialPost(args: {
  id: string; caption?: string; mediaUrls?: string[];
  mediaType?: MediaType; platforms?: Plat[]; scheduledAt?: string;
}) {
  try {
    const db = getDb();
    const ref = db.collection('socialPosts').doc(args.id);
    const snap = await ref.get();
    if (!snap.exists) return fail(`Social post \`${args.id}\` not found.`);
    const cur = snap.data() as any;
    if (cur.status === 'publishing' || cur.status === 'published') {
      return fail(`Cannot edit a ${cur.status} post.`);
    }

    const patch: Record<string, unknown> = { updatedAt: Timestamp.now() };
    if (args.caption !== undefined) patch.caption = args.caption;
    if (args.mediaUrls !== undefined) patch.mediaUrls = args.mediaUrls;
    if (args.mediaType !== undefined) patch.mediaType = args.mediaType;
    if (args.platforms !== undefined) patch.platforms = args.platforms;
    if (args.scheduledAt !== undefined) {
      const ms = parseMs(args.scheduledAt);
      if (ms === null) return fail(`Could not parse scheduledAt: "${args.scheduledAt}".`);
      if (ms <= Date.now()) return fail('scheduledAt must be in the future.');
      patch.scheduledAt = Timestamp.fromMillis(ms);
      patch.status = 'scheduled';
    }

    const platforms = (patch.platforms ?? cur.platforms) as Plat[] | undefined;
    const mediaType = (patch.mediaType ?? cur.mediaType) as MediaType;
    const mediaUrls = (patch.mediaUrls ?? cur.mediaUrls) as string[] | undefined;
    if (platforms?.includes('ig') && (mediaType === 'none' || !mediaUrls?.[0])) {
      return fail('Instagram requires an image or video.');
    }

    await ref.update(patch);
    const when = patch.scheduledAt ? ` — now scheduled for ${fmtCairo((patch.scheduledAt as Timestamp).toMillis())} (Cairo)` : '';
    return ok(`Updated social post \`${args.id}\`${when}.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
