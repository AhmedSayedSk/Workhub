import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Cpu, MemoryStick, HardDrive, Activity } from 'lucide-react'
import type { HostStats } from '@/lib/server/vps/types'
import { cn } from '@/lib/utils'
import { UsageBar } from './UsageBar'
import { Sparkline } from './Sparkline'
import { formatUptime, usageColor } from './format'

interface HostOverviewProps {
  host: HostStats
  cpuHistory: number[]
}

export function HostOverview({ host, cpuHistory }: HostOverviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {/* CPU */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">CPU</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-bold tabular-nums', usageColor(host.cpu.usagePct))}>
            {host.cpu.usagePct}%
          </div>
          <Sparkline data={cpuHistory} />
          <p className="text-xs text-muted-foreground truncate" title={host.cpu.model}>
            {host.cpu.cores} cores · {host.cpu.model}
          </p>
        </CardContent>
      </Card>

      {/* Memory */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Memory</CardTitle>
          <MemoryStick className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3 pt-1">
          <UsageBar
            label="RAM"
            usedBytes={host.memory.usedBytes}
            totalBytes={host.memory.totalBytes}
            availableBytes={host.memory.availableBytes}
          />
          {host.swap.totalBytes > 0 && (
            <UsageBar label="Swap" usedBytes={host.swap.usedBytes} totalBytes={host.swap.totalBytes} />
          )}
        </CardContent>
      </Card>

      {/* Disk */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Disk</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-1">
          <UsageBar
            label="Root /"
            usedBytes={host.disk.usedBytes}
            totalBytes={host.disk.totalBytes}
            availableBytes={host.disk.availableBytes}
          />
        </CardContent>
      </Card>

      {/* Load / uptime */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Load &amp; uptime</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="text-2xl font-bold tabular-nums">
            {host.cpu.load1}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {host.cpu.load5} · {host.cpu.load15}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">load 1 / 5 / 15 min</p>
          <p className="text-xs text-muted-foreground">
            up {formatUptime(host.uptimeSec)} · {host.os}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
