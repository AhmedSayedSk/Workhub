'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { HeaderTitle } from '@/components/layout/HeaderTitle'
import { HeaderActions } from '@/components/layout/HeaderActions'
import type { VpsStats } from '@/lib/server/vps/types'
import { AlertBanner } from './AlertBanner'
import { ContainerTable } from './ContainerTable'
import { StorageCard } from './StorageCard'
import { SecurityDialog } from './SecurityDialog'
import { CertList } from './CertList'
import { MetricCharts } from './MetricCharts'
import { AppsTable } from './AppsTable'
import { ServerIpsCard } from './ServerIps'
import { CronCard } from './CronCard'

const POLL_MS = 5000

export function ServerDetail({ serverId }: { serverId: string }) {
  const [stats, setStats] = useState<(VpsStats & { remote?: boolean; receivedAtMs?: number }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch(`/api/vps/stats?serverId=${encodeURIComponent(serverId)}`)
      if (res.status === 404) { setPending(true); setError(null); return }
      if (!res.ok) { setError(res.status === 403 ? 'Forbidden' : `Request failed (${res.status})`); return }
      setStats(await res.json()); setPending(false); setError(null)
    } catch (e) { setError(String(e)) } finally { setLoading(false) }
  }, [serverId])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, POLL_MS)
    return () => clearInterval(id)
  }, [fetchStats])

  const staleMs = stats?.receivedAtMs ? Date.now() - stats.receivedAtMs : 0

  return (
    <div className="space-y-4">
      <HeaderTitle>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{stats?.meta?.name || 'Server'}</h1>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            {stats?.meta?.subtitle || 'Live VPS stats'}
            {stats?.remote && stats.receivedAtMs ? ` · remote · updated ${Math.round(staleMs / 1000)}s ago` : stats ? ` · updated ${new Date(stats.generatedAtMs).toLocaleTimeString()}` : ''}
          </p>
        </div>
      </HeaderTitle>
      <HeaderActions>
        {stats?.security && <SecurityDialog security={stats.security} />}
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2">
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
        </Button>
      </HeaderActions>

      {loading && !stats && <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading server stats…</div>}
      {pending && !stats && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">Awaiting the first report from this server…</div>}
      {error && <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {stats && (
        <>
          {stats.remote && staleMs > 3 * 60 * 1000 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">Data may be stale — last report {Math.round(staleMs / 1000)}s ago.</div>
          )}
          <AlertBanner alerts={stats.alerts} />
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <MetricCharts host={stats.host} serverId={serverId} />
              <ServerIpsCard ips={stats.meta?.ips} />
              <CronCard crons={stats.crons} apps={stats.apps} cronMeta={stats.cronMeta} />
            </div>
            <div className="space-y-4 lg:col-span-5">
              {stats.storage && <StorageCard storage={stats.storage} />}
              {stats.certs && <CertList certs={stats.certs} />}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            {stats.containers && <div className="lg:col-span-5"><ContainerTable containers={stats.containers} hostMemTotalBytes={stats.host?.memory.totalBytes} hostMemUsedBytes={stats.host?.memory.usedBytes} /></div>}
            {stats.apps && <div className="lg:col-span-7"><AppsTable apps={stats.apps} serverId={serverId} /></div>}
          </div>
          {stats.errors.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {stats.errors.map((e) => (<div key={e.section} className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> {e.section} unavailable: {e.message}</div>))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
