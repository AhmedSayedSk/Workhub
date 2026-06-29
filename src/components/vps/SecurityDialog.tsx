'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Check, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VpsSecurity } from '@/lib/server/vps/types'

export function SecurityDialog({ security }: { security: VpsSecurity }) {
  const [open, setOpen] = useState(false)
  const { checks, passed, total, generatedAtMs } = security
  const hasFail = checks.some((c) => c.status === 'fail')
  const level = hasFail ? 'At risk' : passed === total ? 'Hardened' : 'Good'
  const tone = hasFail ? 'text-red-600' : passed === total ? 'text-green-600' : 'text-amber-600'

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)} title="VPS security posture">
        <ShieldCheck className={cn('h-4 w-4', tone)} />
        Security · {passed}/{total}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className={cn('h-5 w-5', tone)} />
              Security · {level} · {passed}/{total}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2.5">
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
