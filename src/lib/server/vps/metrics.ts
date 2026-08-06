import * as admin from 'firebase-admin'
import { collectHost, rollingCpuPct } from './host'
import { collectSystemStats } from './docker'
import type { MetricPoint, SystemPoint, VpsStats, SnapshotEnvelope } from './types'

// Persistent time-series for the Server dashboard charts. A once-a-minute cron
// hits /api/vps/sample → sampleAndStore() writes a compact snapshot to Firestore
// `vpsMetrics`. The owner-gated /api/vps/history reads + downsamples a range.
// Reads go through the Admin SDK (server-side), so no client Firestore rule is
// needed and the data stays owner-only via the API gate.

const COL = 'vpsMetrics'
const RETAIN_MS = 7 * 24 * 60 * 60 * 1000
// Hourly-averaged per-system rollup, kept longer for the 30d per-system view.
const SYS_COL = 'vpsSystemHourly'
const SYS_RETAIN_MS = 35 * 24 * 60 * 60 * 1000
const SNAP_COL = 'vpsSnapshots'
// Hourly-averaged HOST rollup for the 30d resource view — per-minute vpsMetrics
// only retains 7d, so the long view reads this (same 35d retention as SYS_COL).
const HOST_COL = 'vpsHostHourly'

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

export async function sampleAndStore(serverId: string = 'primary'): Promise<MetricPoint> {
  const [host, rollingCpu, systems] = await Promise.all([
    collectHost(),
    rollingCpuPct(),
    // Per-system slice is best-effort: never let it block the host point.
    collectSystemStats().catch(() => undefined),
  ])
  const point: MetricPoint = {
    ts: Date.now(),
    serverId,
    // Prefer the rolling ~60s average; fall back to the in-request sample only
    // on the first tick after a restart (before a baseline exists).
    cpuPct: rollingCpu ?? host.cpu.usagePct,
    memPct: pct(host.memory.usedBytes, host.memory.totalBytes),
    diskPct: pct(host.disk.usedBytes, host.disk.totalBytes),
    load1: host.cpu.load1,
  }
  if (systems && Object.keys(systems).length) point.systems = systems
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

export async function storeSnapshot(serverId: string, stats: VpsStats): Promise<void> {
  await db().collection(SNAP_COL).doc(serverId).set({ stats, receivedAtMs: Date.now() })
}

export async function readSnapshot(serverId: string): Promise<SnapshotEnvelope | null> {
  const doc = await db().collection(SNAP_COL).doc(serverId).get()
  return doc.exists ? (doc.data() as SnapshotEnvelope) : null
}

// Most-recent per-minute sample per server, so the servers-list card can show
// the same rolling CPU/mem/disk the detail view does instead of a noisy live
// reading. One range-filtered read covers every server; cached briefly since
// the underlying series only advances once a minute.
let _latestCache: { at: number; byServer: Record<string, MetricPoint> } | null = null
const LATEST_TTL_MS = 15 * 1000
export async function readLatestSamples(): Promise<Record<string, MetricPoint>> {
  if (_latestCache && Date.now() - _latestCache.at < LATEST_TTL_MS) return _latestCache.byServer
  const cutoff = Date.now() - 5 * 60 * 1000
  const snap = await db().collection(COL).where('ts', '>=', cutoff).get()
  const byServer: Record<string, MetricPoint> = {}
  for (const d of snap.docs) {
    const p = d.data() as MetricPoint
    const id = p.serverId || 'primary'
    if (!byServer[id] || p.ts > byServer[id].ts) byServer[id] = p
  }
  _latestCache = { at: Date.now(), byServer }
  return byServer
}

// Store a MetricPoint the agent already computed (remote push path).
export async function storePushedSample(serverId: string, point: MetricPoint): Promise<void> {
  await db().collection(COL).add({ ...point, serverId, ts: point.ts || Date.now() })
  if (new Date().getMinutes() === 0) await prune()
}

// One hourly doc in vpsSystemHourly: hourly average of the last ~60 per-minute
// per-system samples. Hit hourly by a host cron via POST /api/vps/rollup.
interface SystemHourlyDoc {
  ts: number
  serverId?: string
  systems: Record<string, { cpu: number; mem: number }>
}

export async function rollupSystemHourly(serverId: string = 'primary'): Promise<SystemHourlyDoc> {
  const cutoff = Date.now() - 60 * 60 * 1000
  const snap = await db().collection(COL).where('ts', '>=', cutoff).get()
  const acc: Record<string, { cpu: number; mem: number; n: number }> = {}
  for (const d of snap.docs) {
    const data = d.data() as MetricPoint
    if ((data.serverId || 'primary') !== serverId) continue
    const sys = data.systems
    if (!sys) continue
    for (const [id, v] of Object.entries(sys)) {
      const a = acc[id] || { cpu: 0, mem: 0, n: 0 }
      a.cpu += v.cpu
      a.mem += v.mem
      a.n += 1
      acc[id] = a
    }
  }
  const systems: Record<string, { cpu: number; mem: number }> = {}
  for (const [id, a] of Object.entries(acc)) {
    systems[id] = {
      cpu: Math.round((a.cpu / a.n) * 10) / 10,
      mem: Math.round(a.mem / a.n),
    }
  }
  const doc: SystemHourlyDoc & { serverId: string } = { ts: Date.now(), systems, serverId }
  if (Object.keys(systems).length) await db().collection(SYS_COL).add(doc)
  await pruneSystemHourly()
  return doc
}

async function pruneSystemHourly(): Promise<void> {
  const cutoff = Date.now() - SYS_RETAIN_MS
  const snap = await db().collection(SYS_COL).where('ts', '<', cutoff).limit(400).get()
  if (snap.empty) return
  const batch = db().batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

// Hourly average of the last ~60 per-minute HOST points → one vpsHostHourly doc,
// so the 30d resource view has data beyond vpsMetrics' 7d window. Hit hourly by
// the same cron as rollupSystemHourly (POST /api/vps/rollup), per server.
export async function rollupHostHourly(serverId: string = 'primary'): Promise<MetricPoint | null> {
  const cutoff = Date.now() - 60 * 60 * 1000
  const snap = await db().collection(COL).where('ts', '>=', cutoff).get()
  const pts = snap.docs.map((d) => d.data() as MetricPoint).filter((p) => (p.serverId || 'primary') === serverId)
  if (!pts.length) {
    await pruneHostHourly()
    return null
  }
  const avg = (f: (p: MetricPoint) => number) => pts.reduce((s, p) => s + f(p), 0) / pts.length
  const doc: MetricPoint = {
    ts: Date.now(),
    serverId,
    cpuPct: Math.round(avg((p) => p.cpuPct) * 10) / 10,
    memPct: Math.round(avg((p) => p.memPct) * 10) / 10,
    diskPct: Math.round(avg((p) => p.diskPct) * 10) / 10,
    load1: Math.round(avg((p) => p.load1) * 100) / 100,
  }
  await db().collection(HOST_COL).add(doc)
  await pruneHostHourly()
  return doc
}

async function pruneHostHourly(): Promise<void> {
  const cutoff = Date.now() - SYS_RETAIN_MS
  const snap = await db().collection(HOST_COL).where('ts', '<', cutoff).limit(400).get()
  if (snap.empty) return
  const batch = db().batch()
  snap.docs.forEach((d) => batch.delete(d.ref))
  await batch.commit()
}

const RANGE_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '8h': 8 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}
// Target point count per range so each line is sensibly resolved.
// Longer ranges use fewer (averaged) points for a smoother, less busy line.
const TARGET_POINTS: Record<string, number> = { '1h': 60, '8h': 96, '24h': 72, '7d': 84, '30d': 120 }
const CACHE_TTL_MS: Record<string, number> = { '1h': 30_000, '8h': 60_000, '24h': 120_000, '7d': 600_000, '30d': 1_800_000 }
const cache: Record<string, { at: number; data: MetricPoint[] }> = {}

export async function readHistory(range: string, serverId: string = 'primary'): Promise<MetricPoint[]> {
  const rangeMs = RANGE_MS[range] ?? RANGE_MS['24h']
  const ttl = CACHE_TTL_MS[range] ?? 120_000
  const cacheKey = `${serverId}:${range}`
  const cached = cache[cacheKey]
  if (cached && Date.now() - cached.at < ttl) return cached.data

  const cutoff = Date.now() - rangeMs
  // 30d reads the hourly-averaged vpsHostHourly (35d retention); shorter ranges
  // read the per-minute vpsMetrics (7d retention). Single-field range filter only
  // (sort + serverId filter client-side) to avoid composite indexes.
  const col = range === '30d' ? HOST_COL : COL
  const snap = await db().collection(col).where('ts', '>=', cutoff).get()
  const raw = snap.docs
    .map((d) => d.data() as MetricPoint)
    .filter((p) => (p.serverId || 'primary') === serverId)
    .sort((a, b) => a.ts - b.ts)
  const data = downsample(raw, TARGET_POINTS[range] ?? 168)
  cache[cacheKey] = { at: Date.now(), data }
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

// --- per-system history ----------------------------------------------------
// 24h/3d/7d read the per-minute vpsMetrics (systems map); 30d reads the
// hourly-averaged vpsSystemHourly (already coarse) instead.
const SYS_RANGE_MS: Record<string, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}
const SYS_TARGET = 90
const SYS_CACHE_TTL_MS: Record<string, number> = {
  '24h': 120_000,
  '3d': 300_000,
  '7d': 600_000,
  '30d': 1_800_000,
}
const sysCache: Record<string, { at: number; data: SystemPoint[] }> = {}

// Same time-bucket averaging as downsample(), for {ts,cpu,mem} system points.
function downsampleSystem(points: SystemPoint[], target: number): SystemPoint[] {
  if (points.length <= target) return points
  const first = points[0].ts
  const last = points[points.length - 1].ts
  const span = Math.max(1, last - first)
  const bucketMs = span / target
  const buckets = new Map<number, SystemPoint[]>()
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
      const avg = (f: (p: SystemPoint) => number) => arr.reduce((s, p) => s + f(p), 0) / arr.length
      return {
        ts: Math.round(avg((p) => p.ts)),
        cpu: Math.round(avg((p) => p.cpu) * 10) / 10,
        mem: Math.round(avg((p) => p.mem)),
      }
    })
}

export async function readSystemHistory(systemId: string, range: string, serverId: string = 'primary'): Promise<SystemPoint[]> {
  const rangeMs = SYS_RANGE_MS[range] ?? SYS_RANGE_MS['24h']
  const useHourly = range === '30d'
  const cacheKey = `${serverId}:${systemId}:${range}`
  const ttl = SYS_CACHE_TTL_MS[range] ?? 120_000
  const cached = sysCache[cacheKey]
  if (cached && Date.now() - cached.at < ttl) return cached.data

  const cutoff = Date.now() - rangeMs
  const col = useHourly ? SYS_COL : COL
  // Single-field range filter only (sort client-side) — no composite index.
  const snap = await db().collection(col).where('ts', '>=', cutoff).get()
  const raw: SystemPoint[] = snap.docs
    .map((d) => ({ raw: d.data() as { ts: number; systems?: Record<string, { cpu: number; mem: number }>; serverId?: string } }))
    .filter((e) => (e.raw.serverId || 'primary') === serverId)
    .map((e) => {
      const v = e.raw.systems?.[systemId]
      return { ts: e.raw.ts, cpu: v?.cpu ?? 0, mem: v?.mem ?? 0 }
    })
    .sort((a, b) => a.ts - b.ts)
  const data = useHourly ? raw : downsampleSystem(raw, SYS_TARGET)
  sysCache[cacheKey] = { at: Date.now(), data }
  return data
}
