'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { authFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldAlert, RefreshCw, AlertCircle } from 'lucide-react'
import { HeaderTitle } from '@/components/layout/HeaderTitle'
import { HeaderActions } from '@/components/layout/HeaderActions'
import type { VpsStats } from '@/lib/server/vps/types'
import { AlertBanner } from '@/components/vps/AlertBanner'
import { HostOverview } from '@/components/vps/HostOverview'
import { ContainerTable } from '@/components/vps/ContainerTable'
import { StorageCard } from '@/components/vps/StorageCard'
import { CertList } from '@/components/vps/CertList'
import { MetricCharts } from '@/components/vps/MetricCharts'
import { AppsTable } from '@/components/vps/AppsTable'

const POLL_MS = 5000
const CPU_HISTORY = 30

const pctOf = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 1000) / 10 : 0)

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
      {/* Title + actions live in the global top header bar (portaled). */}
      <HeaderTitle>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">
            {stats?.meta?.name || 'Server'}
          </h1>
          <p className="truncate text-xs leading-tight text-muted-foreground">
            {stats?.meta?.subtitle || 'Live VPS stats'}
            {stats ? ` · updated ${new Date(stats.generatedAtMs).toLocaleTimeString()}` : ''}
          </p>
        </div>
      </HeaderTitle>
      <HeaderActions>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </HeaderActions>

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

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <MetricCharts
                current={
                  stats.host
                    ? {
                        cpuPct: stats.host.cpu.usagePct,
                        memPct: pctOf(stats.host.memory.usedBytes, stats.host.memory.totalBytes),
                        diskPct: pctOf(stats.host.disk.usedBytes, stats.host.disk.totalBytes),
                        load1: stats.host.cpu.load1,
                      }
                    : undefined
                }
              />
            </div>
            <div className="space-y-4 lg:col-span-5">
              {stats.storage && <StorageCard storage={stats.storage} />}
              {stats.certs && <CertList certs={stats.certs} />}
            </div>
          </div>

          {stats.apps && <AppsTable apps={stats.apps} />}

          {stats.containers && <ContainerTable containers={stats.containers} />}

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
