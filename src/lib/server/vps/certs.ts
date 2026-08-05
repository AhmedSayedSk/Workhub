import fs from 'fs'
import path from 'path'
import tls from 'tls'
import type { CertInfo } from './types'
import { parseCaddyfile } from './certDomains'

// TLS cert expiry per domain. We open a TLS handshake to each domain and read
// the peer cert's notAfter. Results cached ~1h since expiry changes slowly and
// handshakes are comparatively expensive.
//
// Domains come from three sources, merged (first that yields anything wins
// nothing - they are unioned, so a domain configured anywhere is checked):
//
//   1. edge-caddy's site files, read-only from CADDY_SITES_DIR. This is the
//      real source of truth and the only one that stays correct by itself.
//   2. edge-caddy's admin API, when reachable.
//   3. the VPS_CERT_DOMAINS env list, as a manual escape hatch.
//
// Why the files rather than the admin API alone: Caddy binds its admin
// endpoint to localhost INSIDE its own container, so http://edge-caddy:2019
// is unreachable from this container and discovery silently returned []. The
// panel therefore showed only whatever VPS_CERT_DOMAINS happened to list -
// 11 hand-maintained entries that drifted out of date as sites were added.
// Exposing the admin API on the shared docker network was rejected: it has no
// authentication, so every container on the box (including ~20 belonging to
// other clients) could rewrite the ingress for all of them.

const CACHE_TTL_MS = 60 * 60 * 1000
let cache: { at: number; data: CertInfo[] } | null = null

function envDomains(): string[] {
  return (process.env.VPS_CERT_DOMAINS || '')
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
}

// Hostnames from edge-caddy's own config, mounted read-only at
// CADDY_SITES_DIR. Parsing lives in ./certDomains (pure, and therefore tested).
//
// The path may be either a DIRECTORY of site fragments (server 1 splits sites
// into `sites/*.caddy`) or a SINGLE Caddyfile (server 2 keeps every block in
// one file). Handling both is what lets the same agent image cover both boxes;
// a directory-only reader silently found nothing on server 2 and the panel fell
// back to whatever the hand-maintained env list happened to say.
function siteFileDomains(): string[] {
  const target = process.env.CADDY_SITES_DIR || '/etc/caddy-sites'
  const hosts = new Set<string>()

  let files: string[]
  try {
    files = fs.statSync(target).isDirectory()
      ? fs
          .readdirSync(target)
          // Fragment naming on server 1, plus a bare `Caddyfile` should the
          // whole config be mounted as a directory.
          .filter((e) => e.endsWith('.caddy') || e.endsWith('.conf') || e === 'Caddyfile')
          .map((e) => path.join(target, e))
      : [target]
  } catch {
    return [] // not mounted - fall through to the other sources
  }

  for (const file of files) {
    let text: string
    try {
      text = fs.readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const host of parseCaddyfile(text)) hosts.add(host)
  }
  return [...hosts]
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
        // Node types issuer DN fields as string | string[]; normalize to a single string.
        const issuerRaw = cert.issuer?.O ?? cert.issuer?.CN
        const issuer = Array.isArray(issuerRaw) ? issuerRaw[0] ?? null : issuerRaw ?? null
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
  const domains = [...new Set([...siteFileDomains(), ...discovered, ...envDomains()])].sort()
  const data = domains.length ? await Promise.all(domains.map(probeOne)) : []
  data.sort((a, b) => (a.daysRemaining ?? 1e9) - (b.daysRemaining ?? 1e9))
  cache = { at: Date.now(), data }
  return data
}
