// Remote collect+push loop for a secondary VPS. Imports the SAME
// framework-agnostic collectors used by WorkHub's own cron (compiled to
// CommonJS at image build time — see Dockerfile) and POSTs a
// { stats, sample } snapshot to WorkHub every INTERVAL_MS.
import { collectVpsStats } from './lib/collect.js'
import { collectHost, rollingCpuPct } from './lib/host.js'
import { collectSystemStats } from './lib/docker.js'

const URL = process.env.WORKHUB_REPORT_URL
const SECRET = process.env.INTERNAL_API_TOKEN
const SERVER_ID = process.env.SERVER_ID || 'secondary'
const INTERVAL_MS = Number(process.env.INTERVAL_MS || 60000)
const pctOf = (u, t) => (t > 0 ? Math.round((u / t) * 1000) / 10 : 0)

if (!URL || !SECRET) {
  console.error('[agent] WORKHUB_REPORT_URL and INTERNAL_API_TOKEN are required — set them in .env')
}

async function buildSample() {
  const [host, rollingCpu, systems] = await Promise.all([
    collectHost(),
    rollingCpuPct(),
    collectSystemStats().catch(() => undefined),
  ])
  const p = {
    ts: Date.now(),
    cpuPct: rollingCpu ?? host.cpu.usagePct,
    memPct: pctOf(host.memory.usedBytes, host.memory.totalBytes),
    diskPct: pctOf(host.disk.usedBytes, host.disk.totalBytes),
    load1: host.cpu.load1,
  }
  if (systems && Object.keys(systems).length) p.systems = systems
  return p
}

async function tick() {
  try {
    const [stats, sample] = await Promise.all([collectVpsStats(), buildSample()])
    const res = await fetch(`${URL}?serverId=${encodeURIComponent(SERVER_ID)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cron-secret': SECRET },
      body: JSON.stringify({ stats, sample }),
    })
    console.log(`[agent] pushed ${SERVER_ID} -> ${res.status}`)
  } catch (e) {
    // Never throw — a failed push must not kill the loop; just retry next tick.
    console.error('[agent] push failed:', e?.message || e)
  }
}

console.log(`[agent] starting; interval=${INTERVAL_MS}ms server=${SERVER_ID}`)
await tick()
setInterval(tick, INTERVAL_MS)
