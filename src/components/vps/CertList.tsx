import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'
import type { CertInfo } from '@/lib/server/vps/types'

function severityVariant(days: number | null): 'secondary' | 'destructive' | 'outline' {
  if (days == null) return 'outline'
  if (days <= 7) return 'destructive'
  if (days <= 14) return 'outline'
  return 'secondary'
}

export function CertList({ certs }: { certs: CertInfo[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          TLS certificates
          <span className="text-sm font-normal text-muted-foreground">({certs.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {certs.length === 0 && <p className="text-sm text-muted-foreground">No domains discovered.</p>}
        {certs.map((c) => (
          <div key={c.domain} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <div className="font-medium truncate">{c.domain}</div>
              <div className="text-xs text-muted-foreground truncate">
                {c.error ? `error: ${c.error}` : c.issuer || 'unknown issuer'}
              </div>
            </div>
            {c.daysRemaining != null ? (
              <Badge variant={severityVariant(c.daysRemaining)} className="font-normal whitespace-nowrap">
                {c.daysRemaining}d left
              </Badge>
            ) : (
              <Badge variant="outline" className="font-normal">
                —
              </Badge>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
