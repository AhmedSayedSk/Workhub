'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { authFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldAlert, RefreshCw, Server, AlertCircle } from 'lucide-react'
import type { VpsStats } from '@/lib/server/vps/types'
import { AlertBanner } from '@/components/vps/AlertBanner'
import { HostOverview } from '@/components/vps/HostOverview'
import { ContainerTable } from '@/components/vps/ContainerTable'
import { StorageCard } from '@/components/vps/StorageCard'
import { CertList } from '@/components/vps/CertList'

const POLL_MS = 5000
const CPU_HISTORY = 30

export default function ServerPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  const [stats, setStats] = useState<VpsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cpuHistory = useRef<number[]>([])

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/vps/stats')
      if (!res.ok) {
        setError(res.status === 403 ? 'Forbidden' : `Request failed (${res.status})`)
        return
      }
      const data: VpsStats = await res.json()
      if (data.host) {
        const next = [...cpuHistory.current, data.host.cpu.usagePct]
        cpuHistory.current = next.slice(-CPU_HISTORY)
      }
      setStats(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAppOwner) return
    fetchStats()
    const id = setInterval(fetchStats, POLL_MS)
    return () => clearInterval(id)
  }, [isAppOwner, fetchStats])

  if (!isAppOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Owner only</h2>
            <p className="text-sm text-muted-foreground">Only the workspace owner can view server stats.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Server className="h-6 w-6" />
            Server
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats?.host ? `${stats.host.hostname} · ` : ''}
            live VPS stats
            {stats ? ` · updated ${new Date(stats.generatedAtMs).toLocaleTimeString()}` : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      {loading && !stats && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading server stats…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {stats && (
        <>
          <AlertBanner alerts={stats.alerts} />

          {stats.host && <HostOverview host={stats.host} cpuHistory={cpuHistory.current} />}

          <div className="grid gap-4 lg:grid-cols-3">
            {stats.containers && (
              <div className="lg:col-span-2">
                <ContainerTable containers={stats.containers} />
              </div>
            )}
            <div className="space-y-4">
              {stats.storage && <StorageCard storage={stats.storage} />}
              {stats.certs && <CertList certs={stats.certs} />}
            </div>
          </div>

          {stats.errors.length > 0 && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {stats.errors.map((e) => (
                <div key={e.section} className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" /> {e.section} unavailable: {e.message}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
