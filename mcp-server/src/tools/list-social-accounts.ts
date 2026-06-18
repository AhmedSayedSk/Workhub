import { getDb } from '../firebase.js';
import { resolveProjectNames, ok, fail } from '../lib/social-posts.js';

export const listSocialAccountsSchema = {};

export async function listSocialAccounts() {
  try {
    const db = getDb();
    const snap = await db.collection('socialAccounts').get();
    if (snap.empty) return ok('No social accounts configured. Use set_social_account to add one.');
    const names = await resolveProjectNames(db, snap.docs.map((d) => d.id));
    const rows = snap.docs.map((d) => {
      const a = d.data() as any;
      const tok = a.token ? `set (…${String(a.token).slice(-4)})` : '—';
      return `| ${names[d.id] || d.id} | ${a.pageId || '—'} | ${a.igUserId || '—'} | ${a.graphVersion || 'v21.0'} | ${tok} |`;
    });
    return ok(`${snap.size} configured account(s):\n\n| Project | FB Page | IG User | Graph | Token |\n|---|---|---|---|---|\n${rows.join('\n')}`);
  } catch (e) {
    return fail((e as Error).message);
  }
}
