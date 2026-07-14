'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { authFetch } from '@/lib/api-client'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldAlert } from 'lucide-react'
import { HeaderTitle } from '@/components/layout/HeaderTitle'
import { ServerCard } from '@/components/vps/ServerCard'
import type { ServerSummary } from '@/lib/server/vps/types'

export default function ServersPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)
  const [servers, setServers] = useState<ServerSummary[]>([])
  const [loading, setLoading] = useState(true)

  const fetchServers = useCallback(async () => {
    try {
      const res = await authFetch('/api/vps/servers')
      if (res.ok) setServers((await res.json()).servers)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!isAppOwner) return
    fetchServers()
    const id = setInterval(fetchServers, 30000)
    return () => clearInterval(id)
  }, [isAppOwner, fetchServers])

  if (!isAppOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md"><CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <ShieldAlert className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Owner only</h2>
          <p className="text-sm text-muted-foreground">Only the workspace owner can view server stats.</p>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <HeaderTitle>
        <div><h1 className="text-lg font-semibold leading-tight tracking-tight">Servers</h1><p className="text-xs text-muted-foreground">Select a server to view its stats</p></div>
      </HeaderTitle>
      {loading && servers.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading servers…</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (<ServerCard key={s.id} server={s} />))}
        </div>
      )}
    </div>
  )
}
