import { readFile, statfs } from 'fs/promises'
import os from 'os'
import type { HostStats } from './types'

// Host metrics read from inside the container. The container shares the host
// kernel, so /proc and os.* reflect the host; fs.statfs('/') reflects the
// backing filesystem (/dev/sda1 via overlay2). No mounts or privilege needed.

interface CpuTimes {
  idle: number
  total: number
}

// Parse the aggregate `cpu ` line of /proc/stat into idle + total jiffies.
export function parseCpuTimes(procStat: string): CpuTimes | null {
  const line = procStat.split('\n').find((l) => l.startsWith('cpu '))
  if (!line) return null
  const parts = line.trim().split(/\s+/).slice(1).map(Number)
  if (parts.length < 5 || parts.some(Number.isNaN)) return null
  // user nice system idle iowait irq softirq steal guest guest_nice
  const idle = parts[3] + (parts[4] || 0) // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0)
  return { idle, total }
}

// CPU usage % between two /proc/stat samples.
export function cpuUsagePct(a: CpuTimes, b: CpuTimes): number {
  const totalDelta = b.total - a.total
  const idleDelta = b.idle - a.idle
  if (totalDelta <= 0) return 0
  const pct = ((totalDelta - idleDelta) / totalDelta) * 100
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10))
}

// Parse /proc/meminfo (values are in kB) into bytes.
export function parseMeminfo(meminfo: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of meminfo.split('\n')) {
    const m = line.match(/^(\w+):\s+(\d+)\s*kB/)
    if (m) out[m[1]] = parseInt(m[2], 10) * 1024
  }
  return out
}

async function sampleCpu(): Promise<CpuTimes | null> {
  try {
    return parseCpuTimes(await readFile('/proc/stat', 'utf8'))
  } catch {
    return null
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function collectHost(): Promise<HostStats> {
  // CPU: two samples ~250ms apart.
  const a = await sampleCpu()
  await delay(250)
  const b = await sampleCpu()
  const usagePct = a && b ? cpuUsagePct(a, b) : 0

  // Memory + swap from /proc/meminfo (fall back to os.* if unreadable).
  let totalBytes = os.totalmem()
  let availableBytes = os.freemem()
  let swapTotal = 0
  let swapUsed = 0
  try {
    const mem = parseMeminfo(await readFile('/proc/meminfo', 'utf8'))
    if (mem.MemTotal) totalBytes = mem.MemTotal
    if (mem.MemAvailable != null) availableBytes = mem.MemAvailable
    if (mem.SwapTotal != null) {
      swapTotal = mem.SwapTotal
      swapUsed = mem.SwapTotal - (mem.SwapFree || 0)
    }
  } catch {
    /* keep os.* fallback */
  }

  // Disk for the root filesystem.
  let diskTotal = 0
  let diskAvail = 0
  let diskUsed = 0
  try {
    const fs = await statfs('/')
    const bsize = fs.bsize
    diskTotal = fs.blocks * bsize
    diskAvail = fs.bavail * bsize
    diskUsed = (fs.blocks - fs.bfree) * bsize
  } catch {
    /* leave zeros */
  }

  const cpus = os.cpus()
  const [load1, load5, load15] = os.loadavg()

  return {
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    uptimeSec: Math.floor(os.uptime()),
    cpu: {
      model: cpus[0]?.model?.trim() || 'unknown',
      cores: cpus.length,
      usagePct,
      load1: round2(load1),
      load5: round2(load5),
      load15: round2(load15),
    },
    memory: {
      totalBytes,
      availableBytes,
      usedBytes: Math.max(0, totalBytes - availableBytes),
    },
    swap: { totalBytes: swapTotal, usedBytes: swapUsed },
    disk: { totalBytes: diskTotal, availableBytes: diskAvail, usedBytes: diskUsed },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
