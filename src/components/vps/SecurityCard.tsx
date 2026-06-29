import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldCheck, Check, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VpsSecurity } from '@/lib/server/vps/types'

export function SecurityCard({ security }: { security: VpsSecurity }) {
  const { checks, passed, total, generatedAtMs } = security
  const hasFail = checks.some((c) => c.status === 'fail')
  const level = hasFail ? 'At risk' : passed === total ? 'Hardened' : 'Good'
  const badge = hasFail
    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
    : passed === total
      ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Security
        </CardTitle>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums', badge)}>
          {level} · {passed}/{total}
        </span>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {checks.map((c) => {
          const Icon = c.status === 'pass' ? Check : c.status === 'warn' ? AlertTriangle : X
          const color =
            c.status === 'pass' ? 'text-green-600' : c.status === 'warn' ? 'text-amber-600' : 'text-red-600'
          return (
            <div key={c.id} className="flex items-start gap-2.5 text-sm">
              <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', color)} />
              <div className="min-w-0 flex-1">
                <div className="font-medium leading-tight">{c.label}</div>
                {c.detail ? <div className="text-xs text-muted-foreground">{c.detail}</div> : null}
              </div>
            </div>
          )
        })}
        {generatedAtMs ? (
          <div className="pt-1 text-xs text-muted-foreground">
            Checked {new Date(generatedAtMs).toLocaleTimeString()}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
