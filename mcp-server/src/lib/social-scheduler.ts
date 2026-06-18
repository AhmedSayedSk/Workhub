// Social-media scheduler integration: reads the local campaign schedulers
// (CoffeePOS + Sikasio), normalizes their differing formats, and can trigger a run.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileP = promisify(execFile);
const req = createRequire(import.meta.url);

const DEFAULT_NODE = '/home/ahmedsk/.nvm/versions/node/v22.17.1/bin/node';

export interface Campaign {
  key: string;
  name: string;
  format: 'schedule-json' | 'posts-data-js';
  dir: string;
  schedule?: string;   // schedule-json
  posts?: string;      // posts-data-js
  fbState?: string;
  igState?: string;
  log?: string;
  run?: string[];      // [scriptFile, ...args] (relative to dir), live
  runDry?: string[];   // dry-run variant
  node?: string;
}

const DEFAULTS: Campaign[] = [
  {
    key: 'coffeepos', name: 'CoffeePOS', format: 'schedule-json',
    dir: '/mnt/c/Users/Ahmed Sayed/Desktop/CoffeePOS-Campaign/scheduler',
    schedule: 'schedule.json', log: 'scheduler.log',
    run: ['local-scheduler.js', '--live'], runDry: ['local-scheduler.js'],
  },
  {
    key: 'sikasio', name: 'Sikasio', format: 'posts-data-js',
    dir: '/mnt/c/Users/Ahmed Sayed/Desktop/Sikasio-Campaign/_scheduler',
    posts: 'posts-data.js', fbState: 'state.json', igState: 'ig-state.json', log: 'scheduler.log',
    run: ['local-scheduler.js'],
  },
];

export function loadCampaigns(): Campaign[] {
  const candidates = [
    process.env.SOCIAL_CAMPAIGNS_CONFIG,
    path.resolve(process.cwd(), 'social-campaigns.json'),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return JSON.parse(fs.readFileSync(c, 'utf8')) as Campaign[]; } catch { /* fall through */ }
  }
  return DEFAULTS;
}

export function getCampaign(key: string): Campaign | undefined {
  return loadCampaigns().find((c) => c.key.toLowerCase() === key.toLowerCase());
}

export type PlatStatus = 'published' | 'scheduled' | 'pending' | 'due' | 'missed' | 'n/a';
export interface NormPost {
  campaign: string;
  campaignKey: string;
  key: string;
  datetime: Date;
  fb: { status: PlatStatus; id?: string };
  ig: { status: PlatStatus; id?: string };
}

function fbStatus(id: string | undefined, dt: Date, now: Date): PlatStatus {
  if (id) return dt <= now ? 'published' : 'scheduled';
  return dt <= now ? 'missed' : 'pending';
}
function igStatus(id: string | undefined, dt: Date, now: Date): PlatStatus {
  if (id) return 'published';
  return dt <= now ? 'due' : 'pending';
}

function readJson(p: string): Record<string, string> {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

export function readPosts(c: Campaign): NormPost[] {
  const now = new Date();
  if (c.format === 'schedule-json') {
    const data = JSON.parse(fs.readFileSync(path.join(c.dir, c.schedule || 'schedule.json'), 'utf8'));
    return (data.entries || []).map((e: any) => {
      const dt = new Date(e.datetime);
      const fbId = typeof e.posted?.facebook === 'string' ? e.posted.facebook.split(':').pop() : undefined;
      const igId = typeof e.posted?.instagram === 'string' ? e.posted.instagram.split(':').pop() : undefined;
      const plats: string[] = e.platforms || [];
      return {
        campaign: c.name, campaignKey: c.key, key: e.id, datetime: dt,
        fb: { status: plats.includes('facebook') ? fbStatus(fbId, dt, now) : 'n/a', id: fbId },
        ig: { status: plats.includes('instagram') ? igStatus(igId, dt, now) : 'n/a', id: igId },
      } as NormPost;
    });
  }
  // posts-data-js: module.exports = [[name, unixSec, caption], ...]
  const postsPath = path.join(c.dir, c.posts || 'posts-data.js');
  try { const r = req.resolve(postsPath); if ((req as any).cache?.[r]) delete (req as any).cache[r]; } catch { /* ignore */ }
  const POSTS = req(postsPath) as [string, number, string][];
  const fb = readJson(path.join(c.dir, c.fbState || 'state.json'));
  const ig = readJson(path.join(c.dir, c.igState || 'ig-state.json'));
  return POSTS.map(([name, unix]) => {
    const dt = new Date(unix * 1000);
    return {
      campaign: c.name, campaignKey: c.key, key: name, datetime: dt,
      fb: { status: fbStatus(fb[name], dt, now), id: fb[name] },
      ig: { status: igStatus(ig[name], dt, now), id: ig[name] },
    } as NormPost;
  });
}

export function allPosts(keys?: string[]): NormPost[] {
  let cs = loadCampaigns();
  if (keys && keys.length) cs = cs.filter((c) => keys.includes(c.key));
  const out: NormPost[] = [];
  for (const c of cs) { try { out.push(...readPosts(c)); } catch { /* skip unreadable campaign */ } }
  return out.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}

export function fmtCairo(d: Date): string {
  try {
    return d.toLocaleString('en-GB', {
      timeZone: 'Africa/Cairo', weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

export const ICON: Record<PlatStatus, string> = {
  published: '✅', scheduled: '⏳', pending: '◻️', due: '🔵', missed: '⚠️', 'n/a': '·',
};

export function lastLog(c: Campaign): { line?: string; mtime?: Date } {
  try {
    const p = path.join(c.dir, c.log || 'scheduler.log');
    const st = fs.statSync(p);
    const lines = fs.readFileSync(p, 'utf8').trimEnd().split('\n');
    return { line: lines[lines.length - 1], mtime: st.mtime };
  } catch { return {}; }
}

export async function cronLines(): Promise<string[]> {
  try { const { stdout } = await execFileP('crontab', ['-l']); return stdout.split('\n'); }
  catch {
    try { const { stdout } = await execFileP('/usr/bin/crontab', ['-l']); return stdout.split('\n'); }
    catch { return []; }
  }
}

export async function runCampaign(c: Campaign, dry: boolean): Promise<string> {
  const args = dry ? (c.runDry || c.run) : c.run;
  if (!args || !args.length) return '(no run command configured)';
  const node = c.node || DEFAULT_NODE;
  const script = path.join(c.dir, args[0]);
  const { stdout, stderr } = await execFileP(node, [script, ...args.slice(1)], {
    cwd: c.dir, timeout: 240_000, maxBuffer: 4 * 1024 * 1024,
  });
  return (stdout || '') + (stderr ? `\n[stderr] ${stderr}` : '');
}
