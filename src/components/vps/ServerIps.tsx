'use client'

import { useState } from 'react'
import { Network, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CollapsiblePanel } from './CollapsiblePanel'

// A colon is the only thing that separates the two families here — the parser
// upstream has already rejected anything that is not an address.
const isIpv6 = (ip: string) => ip.includes(':')

/** Copy-to-clipboard state shared by both renderings. */
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (ip: string, e: React.MouseEvent) => {
    // The server card wraps its chips in a <Link>; copying must not navigate.
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
  return { copied, copy }
}

/**
 * Compact chip row — used on the servers list, where the address is one detail
 * among several and space is tight. Renders nothing when none is configured,
 * so a server without `VPS*_PUBLIC_IP` looks deliberate rather than broken.
 */
export function ServerIps({
  ips,
  className,
  max,
}: {
  ips?: string[] | null
  className?: string
  /** Cap the chips shown; the remainder collapses into a "+N" badge. */
  max?: number
}) {
  const { copied, copy } = useCopy()
  if (!ips || ips.length === 0) return null

  // IPv4 first when the list is capped: it is the address you would actually
  // paste somewhere, and a full IPv6 chip eats the whole row on its own.
  const ordered = max == null ? ips : [...ips].sort((a, b) => Number(isIpv6(a)) - Number(isIpv6(b)))
  const shown = max == null ? ordered : ordered.slice(0, max)
  const hidden = ordered.length - shown.length

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
      <Network className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {shown.map((ip) => (
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
      {hidden > 0 && (
        <span
          className="shrink-0 rounded-md border border-dashed px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground"
          title={ordered.slice(shown.length).join('\n')}
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}

/**
 * Full card — used on a single server's page, under the resource monitor. One
 * row per address, family-tagged, because the question being answered there is
 * "what do I point a DNS record at" and an A record and an AAAA record are not
 * interchangeable.
 */
export function ServerIpsCard({ ips, source }: { ips?: string[] | null; source?: 'detected' | 'configured' }) {
  const { copied, copy } = useCopy()
  if (!ips || ips.length === 0) return null

  return (
    <CollapsiblePanel
      id="public-ips"
      icon={Network}
      title="Public IPs"
      meta={<span className="text-sm font-normal text-muted-foreground">({ips.length})</span>}
      // Say where the list came from. Read off the host it is complete and
      // self-maintaining; falling back to the env value it is only as current
      // as the last person to edit it, and that difference matters when you are
      // checking whether a DNS record points at the right place.
      aside={
        <span
          className="text-xs text-muted-foreground"
          title={
            source === 'detected'
              ? "Read from the host's own interfaces every 15 minutes"
              : 'From VPS_PUBLIC_IP — the host address collector is not running here'
          }
        >
          {source === 'detected' ? 'auto-detected' : source === 'configured' ? 'from config' : 'DNS points here'}
        </span>
      }
      contentClassName="space-y-1.5"
    >
        {ips.map((ip) => (
          <button
            key={ip}
            type="button"
            onClick={(e) => copy(ip, e)}
            title={copied === ip ? 'Copied' : `Copy ${ip}`}
            className="group flex w-full items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border">
                {isIpv6(ip) ? 'IPv6' : 'IPv4'}
              </span>
              <span className="truncate font-mono text-sm tabular-nums">{ip}</span>
            </span>
            {copied === ip ? (
              <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-500">
                <Check className="h-3.5 w-3.5" /> Copied
              </span>
            ) : (
              <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            )}
          </button>
        ))}
    </CollapsiblePanel>
  )
}
