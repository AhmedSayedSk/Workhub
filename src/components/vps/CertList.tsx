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

// Registrable apex of a host (naive last-two-labels — fine for our .com domains).
function apexOf(domain: string): string {
  const host = domain.split('/')[0]
  const parts = host.split('.')
  return parts.length <= 2 ? host : parts.slice(-2).join('.')
}

export function CertList({ certs }: { certs: CertInfo[] }) {
  const groups = new Map<string, CertInfo[]>()
  for (const c of certs) {
    const apex = apexOf(c.domain)
    const arr = groups.get(apex)
    if (arr) arr.push(c)
    else groups.set(apex, [c])
  }
  const grouped = [...groups.entries()]
    .map(([apex, list]) => [apex, [...list].sort((a, b) => a.domain.localeCompare(b.domain))] as const)
    .sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          TLS certificates
          <span className="text-sm font-normal text-muted-foreground">({certs.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {certs.length === 0 && <p className="text-sm text-muted-foreground">No domains discovered.</p>}
        {grouped.map(([apex, list]) => (
          <div key={apex} className="space-y-2">
            {/* Domain group header */}
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{apex}</p>
              <span className="text-[11px] tabular-nums text-muted-foreground/50">{list.length}</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            {list.map((c) => (
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
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
