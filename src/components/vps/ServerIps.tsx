'use client'

import { useState } from 'react'
import { Network, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The public addresses a server answers on — what its domains' DNS records
 * point at. Click an address to copy it, which is the only thing anyone ever
 * does with one on this page.
 *
 * Renders nothing when no address is configured, so a server without
 * `VPS*_PUBLIC_IP` set looks deliberate rather than broken.
 */
export function ServerIps({ ips, className }: { ips?: string[] | null; className?: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  if (!ips || ips.length === 0) return null

  const copy = (ip: string, e: React.MouseEvent) => {
    // The card wraps this in a <Link>; copying must not navigate.
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard?.writeText(ip).then(
      () => {
        setCopied(ip)
        setTimeout(() => setCopied((c) => (c === ip ? null : c)), 1500)
      },
      () => { /* clipboard blocked (insecure origin) — the text is still selectable */ }
    )
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {ips.map((ip) => (
        <button
          key={ip}
          type="button"
          onClick={(e) => copy(ip, e)}
          title={copied === ip ? 'Copied' : `Copy ${ip}`}
          className="group inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-foreground/80 transition hover:border-primary/50 hover:text-foreground"
        >
          {ip}
          {copied === ip ? (
            <Check className="h-3 w-3 text-emerald-500" />
          ) : (
            <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
          )}
        </button>
      ))}
    </div>
  )
}
