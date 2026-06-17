'use client'

import { Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Phase 2 will replace the gated state with the real ads UI when this is 'true'.
const ADS_ENABLED = process.env.NEXT_PUBLIC_META_ADS_ENABLED === 'true'

export function AdsTab() {
  if (!ADS_ENABLED) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Megaphone className="h-6 w-6" />
        </span>
        <h3 className="text-base font-semibold tracking-tight">
          Paid ads unlock after Meta Business Verification
        </h3>
        <p className="max-w-sm text-sm text-muted-foreground">
          We&apos;re completing Meta Business Verification for this account. Once
          it&apos;s approved, you&apos;ll be able to create, launch, and measure
          paid Facebook &amp; Instagram campaigns right here.
        </p>
        <Badge
          variant="secondary"
          className={cn('mt-1 text-muted-foreground')}
        >
          Verification pending
        </Badge>
      </div>
    )
  }

  // TODO(Phase 2): real ads UI (campaign creation, targeting, budget, reporting).
  return null
}
