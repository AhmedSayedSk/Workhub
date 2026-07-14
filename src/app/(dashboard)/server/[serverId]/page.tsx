'use client'

import { use } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { Card, CardContent } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import { ServerDetail } from '@/components/vps/ServerDetail'

export default function ServerDetailPage({ params }: { params: Promise<{ serverId: string }> }) {
  const { serverId } = use(params)
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)
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
  return <ServerDetail serverId={serverId} />
}
