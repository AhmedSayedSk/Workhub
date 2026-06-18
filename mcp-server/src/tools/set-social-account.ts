import { z } from 'zod';
import { getDb } from '../firebase.js';
import { Timestamp } from 'firebase-admin/firestore';
import { ok, fail } from '../lib/social-posts.js';

export const setSocialAccountSchema = {
  projectId: z.string().describe('Project ID to attach the Meta account to'),
  pageId: z.string().optional().describe('Facebook Page ID'),
  igUserId: z.string().optional().describe('Instagram Business account ID'),
  token: z.string().optional().describe('Meta access token (system-user or long-lived page token)'),
  graphVersion: z.string().optional().describe("Graph API version (default 'v21.0')"),
  name: z.string().optional().describe('Display name for the account'),
};

export async function setSocialAccount(args: {
  projectId: string; pageId?: string; igUserId?: string; token?: string; graphVersion?: string; name?: string;
}) {
  try {
    const db = getDb();
    const proj = await db.collection('projects').doc(args.projectId).get();
    if (!proj.exists) return fail(`Project \`${args.projectId}\` not found.`);

    const patch: Record<string, unknown> = { projectId: args.projectId, updatedAt: Timestamp.now() };
    if (args.pageId !== undefined) patch.pageId = args.pageId;
    if (args.igUserId !== undefined) patch.igUserId = args.igUserId;
    if (args.token !== undefined) patch.token = args.token;
    if (args.graphVersion !== undefined) patch.graphVersion = args.graphVersion;
    if (args.name !== undefined) patch.name = args.name;

    await db.collection('socialAccounts').doc(args.projectId).set(patch, { merge: true });
    return ok(`Saved Meta account for **${proj.data()?.name || args.projectId}** — page \`${args.pageId || '(unchanged)'}\`, ig \`${args.igUserId || '(unchanged)'}\`${args.token ? ', token updated' : ''}.`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
