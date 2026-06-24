import * as admin from 'firebase-admin'
import { collectHost } from './host'
import type { MetricPoint } from './types'

// Persistent time-series for the Server dashboard charts. A once-a-minute cron
// hits /api/vps/sample → sampleAndStore() writes a compact snapshot to Firestore
// `vpsMetrics`. The owner-gated /api/vps/history reads + downsamples a range.
// Reads go through the Admin SDK (server-side), so no client Firestore rule is
// needed and the data stays owner-only via the API gate.

const COL = 'vpsMetrics'
const RETAIN_MS = 7 * 24 * 60 * 60 * 1000

// Guarded init — the sample route doesn't import api-auth, so ensure the Admin
// app exists before using Firestore. No-ops if already initialized elsewhere.
function db(): admin.firestore.Firestore {
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    })
  }
  return admin.firestore()
}

function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 1000) / 10 : 0
}

export async function sampleAndStore(): Promise<MetricPoint> {
  const host = await collectHost()
  const point: MetricPoint = {
    ts: Date.now(),
    cpuPct: host.cpu.usagePct,
    memPct: pct(host.memory.usedBytes, host.memory.totalBytes),
    diskPct: pct(host.disk.usedBytes, host.disk.totalBytes),
    load1: host.cpu.load1,
  }
  await db().collection(COL).add(point)
  // Prune old samples roughly once an hour to bound the collection.
  if (new Date().getMinutes() === 0) await prune()
  return point
}

async function prune(): Promise<void> {
  const cutoff = Date.now() - RETAIN_MS
  const snap = await db().collection(COL).where('ts', '<', cutoff).limit(400).get()
  if (snap.empty) return
  const batch = db().batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}
const CACHE_TTL_MS: Record<string, number> = { '1h': 30_000, '24h': 120_000, '7d': 600_000 }
const cache: Record<string, { at: number; data: MetricPoint[] }> = {}

export async function readHistory(range: string): Promise<MetricPoint[]> {
  const rangeMs = RANGE_MS[range] ?? RANGE_MS['24h']
  const ttl = CACHE_TTL_MS[range] ?? 120_000
  const cached = cache[range]
  if (cached && Date.now() - cached.at < ttl) return cached.data

  const cutoff = Date.now() - rangeMs
  // Single-field range filter only (sort client-side) to avoid composite-index needs.
  const snap = await db().collection(COL).where('ts', '>=', cutoff).get()
  const raw = snap.docs.map((d) => d.data() as MetricPoint).sort((a, b) => a.ts - b.ts)
  const data = downsample(raw, 180)
  cache[range] = { at: Date.now(), data }
  return data
}

// Time-bucket average down to ~target points so charts stay light at any range.
export function downsample(points: MetricPoint[], target: number): MetricPoint[] {
  if (points.length <= target) return points
  const first = points[0].ts
  const last = points[points.length - 1].ts
  const span = Math.max(1, last - first)
  const bucketMs = span / target
  const buckets = new Map<number, MetricPoint[]>()
  for (const p of points) {
    const b = Math.floor((p.ts - first) / bucketMs)
    const arr = buckets.get(b)
    if (arr) arr.push(p)
    else buckets.set(b, [p])
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((k) => {
      const arr = buckets.get(k)!
      const avg = (f: (p: MetricPoint) => number) => arr.reduce((s, p) => s + f(p), 0) / arr.length
      return {
        ts: Math.round(avg((p) => p.ts)),
        cpuPct: Math.round(avg((p) => p.cpuPct) * 10) / 10,
        memPct: Math.round(avg((p) => p.memPct) * 10) / 10,
        diskPct: Math.round(avg((p) => p.diskPct) * 10) / 10,
        load1: Math.round(avg((p) => p.load1) * 100) / 100,
      }
    })
}
