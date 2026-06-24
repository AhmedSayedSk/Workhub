import { AlertTriangle, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Alert } from '@/lib/server/vps/types'

// Top-of-page alert stack. Critical alerts render red, warnings amber.
export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (!alerts.length) return null
  return (
    <div className="space-y-2">
      {alerts.map((a) => {
        const critical = a.severity === 'critical'
        const Icon = critical ? AlertOctagon : AlertTriangle
        return (
          <div
            key={a.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm',
              critical
                ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
                : 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium">{a.title}</span>
            <span className="text-muted-foreground">·</span>
            <span>{a.detail}</span>
          </div>
        )
      })}
    </div>
  )
}
