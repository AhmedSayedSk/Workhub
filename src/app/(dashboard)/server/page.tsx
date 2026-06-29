'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { ContainerTable } from '@/components/vps/ContainerTable'
import { StorageCard } from '@/components/vps/StorageCard'
import { CertList } from '@/components/vps/CertList'
import { MetricCharts } from '@/components/vps/MetricCharts'
import { AppsTable } from '@/components/vps/AppsTable'

const POLL_MS = 5000

export default function ServerPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  const [stats, setStats] = useState<VpsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/vps/stats')
      if (!res.ok) {
        setError(res.status === 403 ? 'Forbidden' : `Request failed (${res.status})`)
        return
      }
      const data: VpsStats = await res.json()
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
      <div className="flex min-h-[60vh] items-center justify-center">
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
    <div className="space-y-4">
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
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="gap-2">
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

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <MetricCharts host={stats.host} />
            </div>
            <div className="space-y-4 lg:col-span-5">
              {stats.storage && <StorageCard storage={stats.storage} />}
              {stats.certs && <CertList certs={stats.certs} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            {stats.containers && (
              <div className="lg:col-span-5">
                <ContainerTable containers={stats.containers} />
              </div>
            )}
            {stats.apps && (
              <div className="lg:col-span-7">
                <AppsTable apps={stats.apps} />
              </div>
            )}
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
