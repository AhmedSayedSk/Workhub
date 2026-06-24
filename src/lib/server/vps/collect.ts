import type { VpsStats, SectionError } from './types'
import { collectHost } from './host'
import { collectContainers, collectStorage } from './docker'
import { collectCerts } from './certs'
import { evaluateAlerts } from './alerts'

// Assemble the full VpsStats. Each section is collected independently so a
// single failing source (e.g. docker proxy down) degrades that section to null
// rather than failing the whole dashboard.
export async function collectVpsStats(): Promise<VpsStats> {
  const errors: SectionError[] = []

  const [hostR, containersR, storageR, certsR] = await Promise.allSettled([
    collectHost(),
    collectContainers(),
    collectStorage(),
    collectCerts(),
  ])

  const host = hostR.status === 'fulfilled' ? hostR.value : null
  if (hostR.status === 'rejected') errors.push({ section: 'host', message: String(hostR.reason) })

  const containers = containersR.status === 'fulfilled' ? containersR.value : null
  if (containersR.status === 'rejected') errors.push({ section: 'containers', message: String(containersR.reason) })

  const storage = storageR.status === 'fulfilled' ? storageR.value : null
  if (storageR.status === 'rejected') errors.push({ section: 'storage', message: String(storageR.reason) })

  const certs = certsR.status === 'fulfilled' ? certsR.value : null
  if (certsR.status === 'rejected') errors.push({ section: 'certs', message: String(certsR.reason) })

  const network = containers
    ? containers.reduce(
        (acc, c) => ({ rxBytes: acc.rxBytes + c.netRxBytes, txBytes: acc.txBytes + c.netTxBytes }),
        { rxBytes: 0, txBytes: 0 }
      )
    : null

  const alerts = evaluateAlerts({ host, certs, containers })

  return { generatedAtMs: Date.now(), host, containers, storage, certs, network, alerts, errors }
}
