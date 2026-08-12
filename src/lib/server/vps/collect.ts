import type { VpsStats, SectionError, VpsMeta, HostStats } from './types'
import { collectHost } from './host'
import { collectContainers, collectStorage } from './docker'
import { collectApps } from './apps'
import { collectCerts } from './certs'
import { collectSecurity } from './security'
import { collectCrons } from './crons'
import { collectPublicIps } from './ips'
import { evaluateAlerts } from './alerts'
import { loadRegistry } from './registry'

// Assemble the full VpsStats. Each section is collected independently so a
// single failing source (e.g. docker proxy down) degrades that section to null
// rather than failing the whole dashboard.
export async function collectVpsStats(): Promise<VpsStats> {
  const errors: SectionError[] = []

  const [hostR, containersR, appsR, storageR, certsR, securityR, cronsR, ipsR] = await Promise.allSettled([
    collectHost(),
    collectContainers(),
    collectApps(),
    collectStorage(),
    collectCerts(),
    collectSecurity(),
    collectCrons(),
    collectPublicIps(),
  ])

  const host = hostR.status === 'fulfilled' ? hostR.value : null
  if (hostR.status === 'rejected') errors.push({ section: 'host', message: String(hostR.reason) })

  const containers = containersR.status === 'fulfilled' ? containersR.value : null
  if (containersR.status === 'rejected') errors.push({ section: 'containers', message: String(containersR.reason) })

  const apps = appsR.status === 'fulfilled' ? appsR.value : null
  if (appsR.status === 'rejected') errors.push({ section: 'apps', message: String(appsR.reason) })

  const storage = storageR.status === 'fulfilled' ? storageR.value : null
  if (storageR.status === 'rejected') errors.push({ section: 'storage', message: String(storageR.reason) })

  const certs = certsR.status === 'fulfilled' ? certsR.value : null
  if (certsR.status === 'rejected') errors.push({ section: 'certs', message: String(certsR.reason) })

  // security + cron status come from host-written files; absent in dev — degrade to null silently
  const security = securityR.status === 'fulfilled' ? securityR.value : null
  const crons = cronsR.status === 'fulfilled' ? cronsR.value : null
  // Addresses read off the host. Null (dev, or the file not yet written) means
  // the stats route falls back to the configured VPS*_PUBLIC_IP.
  const detectedIps = ipsR.status === 'fulfilled' ? ipsR.value : null

  const network = containers
    ? containers.reduce(
        (acc, c) => ({ rxBytes: acc.rxBytes + c.netRxBytes, txBytes: acc.txBytes + c.netTxBytes }),
        { rxBytes: 0, txBytes: 0 }
      )
    : null

  const alerts = evaluateAlerts({ host, certs, containers })

  return { generatedAtMs: Date.now(), meta: buildMeta(host, detectedIps?.ips), host, containers, apps, storage, certs, network, security, crons, cronMeta: loadRegistry().cron, alerts, errors }
}

// Header name + subtitle: custom via env, else derived from the live host.
function buildMeta(host: HostStats | null, detectedIps?: string[]): VpsMeta {
  const name = process.env.VPS_DISPLAY_NAME || host?.hostname || 'Server'
  const subtitle =
    process.env.VPS_SUBTITLE ||
    (host ? `${host.os} · ${host.cpu.cores} vCPU / ${Math.round(host.memory.totalBytes / 1e9)} GB` : 'live VPS stats')
  // Detected addresses travel with the snapshot so a remote agent reports its
  // own box's real addressing too. The stats route decides whether to use them
  // or fall back to the configured value.
  return detectedIps?.length
    ? { name, subtitle, ips: detectedIps, ipSource: 'detected' as const }
    : { name, subtitle }
}
