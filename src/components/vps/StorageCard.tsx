import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database } from 'lucide-react'
import type { StorageStats } from '@/lib/server/vps/types'
import { formatBytes } from './format'

export function StorageCard({ storage }: { storage: StorageStats }) {
  const rows = [
    { label: 'Images', value: storage.imagesBytes },
    { label: 'Containers (writable)', value: storage.containersBytes },
    { label: 'Volumes', value: storage.volumesBytes },
    { label: 'Build cache', value: storage.buildCacheBytes },
  ]
  const total = rows.reduce((a, r) => a + r.value, 0)
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4 text-muted-foreground" />
          Docker storage
        </CardTitle>
        <span className="text-sm text-muted-foreground tabular-nums">{formatBytes(total)}</span>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums font-medium">{formatBytes(r.value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
