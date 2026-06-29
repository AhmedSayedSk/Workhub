import type { VpsStats, SectionError, VpsMeta, HostStats } from './types'
import { collectHost } from './host'
import { collectContainers, collectStorage } from './docker'
import { collectApps } from './apps'
import { collectCerts } from './certs'
import { collectSecurity } from './security'
import { evaluateAlerts } from './alerts'

// Assemble the full VpsStats. Each section is collected independently so a
// single failing source (e.g. docker proxy down) degrades that section to null
// rather than failing the whole dashboard.
export async function collectVpsStats(): Promise<VpsStats> {
  const errors: SectionError[] = []

  const [hostR, containersR, appsR, storageR, certsR, securityR] = await Promise.allSettled([
    collectHost(),
    collectContainers(),
    collectApps(),
    collectStorage(),
    collectCerts(),
    collectSecurity(),
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

  // security status comes from a host-written file; absent in dev — degrade to null silently
  const security = securityR.status === 'fulfilled' ? securityR.value : null

  const network = containers
    ? containers.reduce(
        (acc, c) => ({ rxBytes: acc.rxBytes + c.netRxBytes, txBytes: acc.txBytes + c.netTxBytes }),
        { rxBytes: 0, txBytes: 0 }
      )
    : null

  const alerts = evaluateAlerts({ host, certs, containers })

  return { generatedAtMs: Date.now(), meta: buildMeta(host), host, containers, apps, storage, certs, network, security, alerts, errors }
}

// Header name + subtitle: custom via env, else derived from the live host.
function buildMeta(host: HostStats | null): VpsMeta {
  const name = process.env.VPS_DISPLAY_NAME || host?.hostname || 'Server'
  const subtitle =
    process.env.VPS_SUBTITLE ||
    (host ? `${host.os} · ${host.cpu.cores} vCPU / ${Math.round(host.memory.totalBytes / 1e9)} GB` : 'live VPS stats')
  return { name, subtitle }
}
