// Small formatting helpers for the VPS dashboard.

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function pct(used: number, total: number): number {
  return total > 0 ? Math.round((used / total) * 100) : 0
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// Color hint by usage percentage (Tailwind text classes).
export function usageColor(percent: number): string {
  if (percent >= 90) return 'text-red-600 dark:text-red-400'
  if (percent >= 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}
