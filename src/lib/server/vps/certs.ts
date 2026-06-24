import tls from 'tls'
import type { CertInfo } from './types'

// TLS cert expiry per domain. We open a TLS handshake to each domain and read
// the peer cert's notAfter. Domains are auto-discovered from edge-caddy's admin
// API, falling back to the VPS_CERT_DOMAINS env list. Results cached ~1h since
// expiry changes slowly and handshakes are comparatively expensive.

const CACHE_TTL_MS = 60 * 60 * 1000
let cache: { at: number; data: CertInfo[] } | null = null

function envDomains(): string[] {
  return (process.env.VPS_CERT_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
}

// Pull configured hostnames out of Caddy's admin /config/ JSON.
async function discoverDomains(): Promise<string[]> {
  const adminUrl = process.env.CADDY_ADMIN_URL || 'http://edge-caddy:2019'
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${adminUrl}/config/`, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return []
    const cfg = await res.json()
    const hosts = new Set<string>()
    const servers = cfg?.apps?.http?.servers || {}
    for (const srv of Object.values<any>(servers)) {
      for (const route of srv?.routes || []) {
        for (const m of route?.match || []) {
          for (const h of m?.host || []) {
            if (typeof h === 'string' && h.includes('.')) hosts.add(h)
          }
        }
      }
    }
    return [...hosts]
  } catch {
    return []
  }
}

function probeOne(domain: string): Promise<CertInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate()
        socket.end()
        if (!cert || !cert.valid_to) {
          resolve({ domain, issuer: null, validToMs: null, daysRemaining: null, error: 'no cert' })
          return
        }
        const validToMs = new Date(cert.valid_to).getTime()
        const daysRemaining = Math.floor((validToMs - Date.now()) / (24 * 60 * 60 * 1000))
        const issuer = cert.issuer?.O || cert.issuer?.CN || null
        resolve({ domain, issuer, validToMs, daysRemaining })
      }
    )
    socket.setTimeout(6000)
    socket.on('error', (e) =>
      resolve({ domain, issuer: null, validToMs: null, daysRemaining: null, error: e.message })
    )
    socket.on('timeout', () => {
      socket.destroy()
      resolve({ domain, issuer: null, validToMs: null, daysRemaining: null, error: 'timeout' })
    })
  })
}

export async function collectCerts(force = false): Promise<CertInfo[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data
  }
  const discovered = await discoverDomains()
  const domains = [...new Set([...discovered, ...envDomains()])]
  const data = domains.length ? await Promise.all(domains.map(probeOne)) : []
  data.sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9))
  cache = { at: Date.now(), data }
  return data
}
