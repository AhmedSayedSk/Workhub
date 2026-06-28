'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  RefreshCw,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import type { Project, SocialPlatform } from '@/types'
import { authFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface InsightResult {
  metrics: Record<string, number>
  capturedAt: string | null
  platform: SocialPlatform
  scope: string
  stale?: boolean
}

interface GroupState {
  data: InsightResult | null
  error: string | null
}

const PLATFORMS: { platform: SocialPlatform; label: string; Icon: typeof Facebook }[] = [
  { platform: 'fb', label: 'Facebook', Icon: Facebook },
  { platform: 'ig', label: 'Instagram', Icon: Instagram },
  { platform: 'li', label: 'LinkedIn', Icon: Linkedin },
]

function humanize(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return value.toLocaleString()
}

function formatCaptured(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return null
  }
}

export function InsightsTab({ project }: { project: Project }) {
  // project is part of the contract; insights are account-scoped for the connected page.
  void project

  const [loading, setLoading] = useState(true)
  const [fbState, setFbState] = useState<GroupState>({ data: null, error: null })
  const [igState, setIgState] = useState<GroupState>({ data: null, error: null })

  const fetchOne = useCallback(async (platform: SocialPlatform): Promise<GroupState> => {
    try {
      const res = await authFetch(
        `/api/social/insights?scope=account&platform=${platform}`,
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { data: null, error: data?.error ?? 'Failed to load insights' }
      }
      return { data: data as InsightResult, error: null }
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : 'Failed to load insights' }
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [fb, ig] = await Promise.all([fetchOne('fb'), fetchOne('ig')])
    setFbState(fb)
    setIgState(ig)
    setLoading(false)
  }, [fetchOne])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Account insights</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading insights…
        </div>
      ) : (
        <div className="space-y-6">
          {PLATFORMS.map(({ platform, label, Icon }) => {
            // LinkedIn analytics aren't fetched yet — show the platform with an empty state.
            const state = platform === 'fb' ? fbState : platform === 'ig' ? igState : { data: null, error: null }
            const metricKeys = state.data ? Object.keys(state.data.metrics) : []
            const captured = formatCaptured(state.data?.capturedAt ?? null)
            return (
              <div key={platform} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                  {state.data?.stale && (
                    <Badge variant="secondary" className="gap-1 text-muted-foreground">
                      <AlertCircle className="h-3 w-3" /> Stale
                    </Badge>
                  )}
                  {captured && (
                    <span className="text-xs text-muted-foreground">
                      Updated {captured}
                    </span>
                  )}
                </div>

                {state.error ? (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {state.error}
                  </div>
                ) : metricKeys.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    No metrics available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {metricKeys.map((key) => (
                      <div
                        key={key}
                        className={cn(
                          'rounded-lg border bg-card px-4 py-3',
                        )}
                      >
                        <p className="text-xs text-muted-foreground">{humanize(key)}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">
                          {formatValue(state.data!.metrics[key])}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
