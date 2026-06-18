// Shared helpers for the social-post MCP tools (drive the WorkHub `socialPosts` model).
import type { Firestore } from 'firebase-admin/firestore';

export type Plat = 'fb' | 'ig';
export type MediaType = 'none' | 'image' | 'video';
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';

/** Accept epoch ms, epoch seconds, or an ISO-8601 string -> epoch ms (or null). */
export function parseMs(v: string): number | null {
  const s = v.trim();
  if (/^\d+$/.test(s)) { const n = Number(s); return n > 1e12 ? n : n * 1000; }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function tsMs(ts: any): number {
  try {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  } catch { /* ignore */ }
  return 0;
}

export function fmtCairo(msVal: number): string {
  if (!msVal) return '—';
  try {
    return new Date(msVal).toLocaleString('en-GB', {
      timeZone: 'Africa/Cairo', weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return new Date(msVal).toISOString().slice(0, 16).replace('T', ' '); }
}

const STATUS_ICON: Record<string, string> = {
  draft: '📝', scheduled: '⏳', publishing: '⏫', published: '✅', failed: '⚠️',
};
export const statusIcon = (s: string) => STATUS_ICON[s] || '·';

export async function resolveProjectNames(db: Firestore, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => {
    try { const d = await db.collection('projects').doc(id).get(); out[id] = (d.exists && (d.data()?.name as string)) || id; }
    catch { out[id] = id; }
  }));
  return out;
}

export const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
export const fail = (text: string) => ({ content: [{ type: 'text' as const, text: `Error: ${text}` }], isError: true });
