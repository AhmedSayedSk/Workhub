import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatBytes, pct, usageColor } from './format'

interface UsageBarProps {
  label: string
  usedBytes: number
  totalBytes: number
  availableBytes?: number
}

// A labeled usage bar: "Memory  2.1 / 3.7 GB (57%)" + progress.
export function UsageBar({ label, usedBytes, totalBytes, availableBytes }: UsageBarProps) {
  const percent = pct(usedBytes, totalBytes)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-medium tabular-nums', usageColor(percent))}>{percent}%</span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>
          {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
        </span>
        {availableBytes != null && <span>{formatBytes(availableBytes)} free</span>}
      </div>
    </div>
  )
}
