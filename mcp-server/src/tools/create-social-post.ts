import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { getAuthor } from '../lib/author.js';
import { parseMs, fmtCairo, ok, fail, type Plat, type MediaType } from '../lib/social-posts.js';

export const createSocialPostSchema = {
  projectId: z.string().describe('WorkHub project ID this post belongs to'),
  platforms: z.array(z.enum(['fb', 'ig'])).min(1).describe("Target platforms: 'fb' and/or 'ig'"),
  caption: z.string().optional().describe('Post caption / text'),
  mediaUrls: z.array(z.string()).optional().describe('Public media URLs (e.g. Firebase Storage). Instagram requires at least one.'),
  mediaType: z.enum(['none', 'image', 'video']).optional().describe("Media type (default 'none')"),
  scheduledAt: z.string().optional().describe('When to publish — ISO-8601 (e.g. 2026-07-01T20:30:00+02:00) or epoch ms. If set → scheduled; otherwise saved as a draft.'),
};

export async function createSocialPost(args: {
  projectId: string; platforms: Plat[]; caption?: string;
  mediaUrls?: string[]; mediaType?: MediaType; scheduledAt?: string;
}) {
  try {
    const db = getDb();
    const proj = await db.collection('projects').doc(args.projectId).get();
    if (!proj.exists) return fail(`Project \`${args.projectId}\` not found.`);

    const platforms = args.platforms;
    const mediaUrls = args.mediaUrls ?? [];
    const mediaType: MediaType = args.mediaType ?? 'none';
    if (platforms.includes('ig') && (mediaType === 'none' || !mediaUrls[0])) {
      return fail('Instagram requires an image or video — set mediaType and provide mediaUrls.');
    }

    let scheduledAt: Timestamp | null = null;
    let status = 'draft';
    if (args.scheduledAt) {
      const ms = parseMs(args.scheduledAt);
      if (ms === null) return fail(`Could not parse scheduledAt: "${args.scheduledAt}".`);
      if (ms <= Date.now()) return fail('scheduledAt must be in the future.');
      scheduledAt = Timestamp.fromMillis(ms);
      status = 'scheduled';
    }

    const { authorId } = getAuthor();
    const now = Timestamp.now();
    const ref = await db.collection('socialPosts').add({
      projectId: args.projectId, platforms, caption: args.caption ?? '',
      mediaUrls, mediaType, status, scheduledAt, publishedAt: null,
      fbPostId: null, igMediaId: null, error: null, attempts: 0,
      createdBy: authorId, createdAt: now, updatedAt: now,
    });

    const when = scheduledAt ? ` scheduled for ${fmtCairo(scheduledAt.toMillis())} (Cairo)` : ' (draft)';
    return ok(`Created social post${when} on **${platforms.join(' + ')}** for **${proj.data()?.name || args.projectId}**.\nID: \`${ref.id}\``);
  } catch (e) {
    return fail((e as Error).message);
  }
}
