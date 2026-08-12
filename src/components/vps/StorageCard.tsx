import { Database } from 'lucide-react'
import type { StorageStats } from '@/lib/server/vps/types'
import { formatBytes } from './format'
import { CollapsiblePanel } from './CollapsiblePanel'

export function StorageCard({ storage }: { storage: StorageStats }) {
  const rows = [
    { label: 'Images', value: storage.imagesBytes },
    { label: 'Containers (writable)', value: storage.containersBytes },
    { label: 'Volumes', value: storage.volumesBytes },
    { label: 'Build cache', value: storage.buildCacheBytes },
  ]
  const total = rows.reduce((a, r) => a + r.value, 0)
  return (
    <CollapsiblePanel
      id="storage"
      icon={Database}
      title="Docker storage"
      // The total stays visible when collapsed — it is the one number this
      // panel exists to report, so hiding it would defeat collapsing it.
      aside={<span className="text-sm text-muted-foreground tabular-nums">{formatBytes(total)}</span>}
      contentClassName="space-y-2"
    >
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="tabular-nums font-medium">{formatBytes(r.value)}</span>
        </div>
      ))}
    </CollapsiblePanel>
  )
}
