'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { auditLogs, userProfiles } from '@/lib/firestore'
import { AuditLog, AuditLogType } from '@/types'
import { formatRelativeTime, formatDateTime } from '@/lib/utils'
import {
  Loader2,
  ShieldAlert,
  ScrollText,
  Filter,
  X,
  LogIn,
  LogOut,
  XCircle,
  FolderKanban,
  ListTodo,
  MessageSquare,
  Layers,
  KeyRound,
  Shield,
  Users,
  Share2,
  Settings,
  FolderOpen,
  Wallet,
  CalendarDays,
  Paperclip,
  Search,
  FileText,
  Clock,
  Flag,
  CheckSquare,
  User,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const TYPE_CONFIG: Record<AuditLogType, { label: string; icon: any; color: string }> = {
  login:        { label: 'Login',        icon: LogIn,         color: 'text-green-600 dark:text-green-400' },
  login_failed: { label: 'Failed Login', icon: XCircle,       color: 'text-red-600 dark:text-red-400' },
  logout:       { label: 'Logout',       icon: LogOut,        color: 'text-gray-500' },
  project:      { label: 'Project',      icon: FolderKanban,  color: 'text-blue-600 dark:text-blue-400' },
  task:         { label: 'Task',         icon: ListTodo,      color: 'text-purple-600 dark:text-purple-400' },
  comment:      { label: 'Comment',      icon: MessageSquare, color: 'text-sky-600 dark:text-sky-400' },
  feature:      { label: 'Feature',      icon: Layers,        color: 'text-indigo-600 dark:text-indigo-400' },
  vault:        { label: 'Vault',        icon: KeyRound,      color: 'text-amber-600 dark:text-amber-400' },
  permission:   { label: 'Permission',   icon: Shield,        color: 'text-orange-600 dark:text-orange-400' },
  member:       { label: 'Member',       icon: Users,         color: 'text-teal-600 dark:text-teal-400' },
  sharing:      { label: 'Sharing',      icon: Share2,        color: 'text-pink-600 dark:text-pink-400' },
  settings:     { label: 'Settings',     icon: Settings,      color: 'text-gray-600 dark:text-gray-400' },
  media:        { label: 'Media',        icon: FolderOpen,    color: 'text-cyan-600 dark:text-cyan-400' },
  payment:      { label: 'Payment',      icon: Wallet,        color: 'text-emerald-600 dark:text-emerald-400' },
  calendar:     { label: 'Calendar',     icon: CalendarDays,  color: 'text-rose-600 dark:text-rose-400' },
  attachment:   { label: 'Attachment',   icon: Paperclip,     color: 'text-violet-600 dark:text-violet-400' },
  note:         { label: 'Note',         icon: FileText,      color: 'text-yellow-600 dark:text-yellow-400' },
  subtask:      { label: 'Subtask',      icon: CheckSquare,   color: 'text-purple-500 dark:text-purple-300' },
  time_entry:   { label: 'Time Entry',   icon: Clock,         color: 'text-lime-600 dark:text-lime-400' },
  milestone:    { label: 'Milestone',    icon: Flag,          color: 'text-fuchsia-600 dark:text-fuchsia-400' },
}

const ALL_TYPES = Object.keys(TYPE_CONFIG) as AuditLogType[]

const TYPE_GROUPS = [
  { label: 'Auth', types: ['login', 'login_failed', 'logout'] as AuditLogType[] },
  { label: 'Projects', types: ['project', 'task', 'subtask', 'comment', 'feature', 'vault', 'attachment', 'note', 'milestone'] as AuditLogType[] },
  { label: 'Team', types: ['member', 'permission', 'sharing'] as AuditLogType[] },
  { label: 'System', types: ['settings', 'calendar', 'media', 'payment', 'time_entry'] as AuditLogType[] },
]

const PAGE_SIZE = 50

export default function AuditLogsPage() {
  const { user } = useAuth()
  const { settings } = useSettings()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [nameMap, setNameMap] = useState<Map<string, string>>(new Map())
  const [collapsedUsers, setCollapsedUsers] = useState<Set<string>>(new Set())

  // Filters
  const [filterOpen, setFilterOpen] = useState(true)
  const [selectedTypes, setSelectedTypes] = useState<Set<AuditLogType>>(new Set(ALL_TYPES))
  const [selectedUser, setSelectedUser] = useState<string>('_all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (dateFrom) filters.startDate = new Date(dateFrom + 'T00:00:00')
      if (dateTo) filters.endDate = new Date(dateTo + 'T23:59:59')
      const result = await auditLogs.getAll(filters)
      setLogs(result)

      const uids = [...new Set(result.map((l) => l.actorUid).filter(Boolean))] as string[]
      if (uids.length > 0) {
        const profiles = await userProfiles.getByUids(uids)
        const map = new Map<string, string>()
        profiles.forEach((p) => {
          if (p.displayName) map.set(p.uid, p.displayName)
        })
        setNameMap(map)
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (!isAppOwner) return
    fetchLogs()
  }, [isAppOwner, fetchLogs])


  const getDisplayName = useCallback((log: AuditLog) => {
    if (log.actorUid && nameMap.has(log.actorUid)) return nameMap.get(log.actorUid)!
    const email = log.actorEmail
    if (!email) return 'Unknown'
    return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }, [nameMap])

  const getUserKey = (log: AuditLog) => log.actorUid || log.actorEmail || 'unknown'

  const actorOptions = useMemo(() => {
    const map = new Map<string, { uid: string; name: string }>()
    logs.forEach((l) => {
      const key = l.actorUid || l.actorEmail
      if (key && !map.has(key)) {
        map.set(key, { uid: key, name: getDisplayName(l) })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [logs, getDisplayName])

  const filteredLogs = useMemo(() => {
    let result = logs

    // Type filter
    if (selectedTypes.size < ALL_TYPES.length) {
      result = result.filter((l) => selectedTypes.has(l.type))
    }

    // User filter
    if (selectedUser !== '_all') {
      result = result.filter((l) => l.actorUid === selectedUser || l.actorEmail === selectedUser)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q) ||
        l.targetName?.toLowerCase().includes(q) ||
        l.projectName?.toLowerCase().includes(q) ||
        l.type.toLowerCase().includes(q) ||
        JSON.stringify(l.details || {}).toLowerCase().includes(q)
      )
    }

    return result
  }, [logs, selectedTypes, selectedUser, searchQuery])

  const visibleLogs = filteredLogs.slice(0, visibleCount)

  const groupedByUser = useMemo(() => {
    const groups: { userKey: string; displayName: string; logs: AuditLog[] }[] = []
    const map = new Map<string, AuditLog[]>()
    const orderKeys: string[] = []
    visibleLogs.forEach((log) => {
      const key = getUserKey(log)
      if (!map.has(key)) {
        map.set(key, [])
        orderKeys.push(key)
      }
      map.get(key)!.push(log)
    })
    orderKeys.forEach((key) => {
      const userLogs = map.get(key)!
      groups.push({
        userKey: key,
        displayName: getDisplayName(userLogs[0]),
        logs: userLogs,
      })
    })
    return groups
  }, [visibleLogs, getDisplayName])

  const toggleUserCollapse = (userKey: string) => {
    setCollapsedUsers((prev) => {
      const next = new Set(prev)
      next.has(userKey) ? next.delete(userKey) : next.add(userKey)
      return next
    })
  }

  const toggleType = (type: AuditLogType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      next.has(type) ? next.delete(type) : next.add(type)
      return next
    })
    setVisibleCount(PAGE_SIZE)
  }

  const toggleGroup = (types: AuditLogType[]) => {
    const allSelected = types.every((t) => selectedTypes.has(t))
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      types.forEach((t) => allSelected ? next.delete(t) : next.add(t))
      return next
    })
    setVisibleCount(PAGE_SIZE)
  }

  const clearFilters = () => {
    setSelectedTypes(new Set(ALL_TYPES))
    setSelectedUser('_all')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setVisibleCount(PAGE_SIZE)
  }

  const hasActiveFilters = selectedTypes.size < ALL_TYPES.length || selectedUser !== '_all' || searchQuery || dateFrom || dateTo

  if (!isAppOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ShieldAlert className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Access Restricted</p>
        <p className="text-sm">Only the workspace owner can view audit logs.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            Audit Logs
          </h1>
          <p className="text-sm text-muted-foreground">
            {filteredLogs.length} event{filteredLogs.length !== 1 ? 's' : ''}
            {hasActiveFilters && ` (filtered from ${logs.length})`}
            {' · '}90-day retention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filterOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">!</Badge>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Filter Sidebar */}
        {filterOpen && (
          <Card className="w-64 shrink-0 h-fit">
            <CardContent className="p-4 space-y-4">
              {/* Search */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE) }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              <Separator />

              {/* User Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</Label>
                <Select value={selectedUser} onValueChange={(v) => { setSelectedUser(v); setVisibleCount(PAGE_SIZE) }}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All users</SelectItem>
                    {actorOptions.map((a) => (
                      <SelectItem key={a.uid} value={a.uid}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Date Range */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Range</Label>
                <div className="space-y-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>

              <Separator />

              {/* Type Filters */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Types</Label>
                  <button
                    onClick={() => setSelectedTypes(selectedTypes.size === ALL_TYPES.length ? new Set() : new Set(ALL_TYPES))}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {selectedTypes.size === ALL_TYPES.length ? 'None' : 'All'}
                  </button>
                </div>

                {TYPE_GROUPS.map((group) => {
                  const allChecked = group.types.every((t) => selectedTypes.has(t))
                  const someChecked = group.types.some((t) => selectedTypes.has(t))
                  return (
                    <div key={group.label}>
                      <button
                        onClick={() => toggleGroup(group.types)}
                        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground mb-1"
                      >
                        <Checkbox
                          checked={allChecked}
                          className="h-3 w-3"
                          tabIndex={-1}
                        />
                        {group.label}
                      </button>
                      <div className="ml-5 space-y-0.5">
                        {group.types.map((type) => {
                          const config = TYPE_CONFIG[type]
                          const Icon = config.icon
                          return (
                            <button
                              key={type}
                              onClick={() => toggleType(type)}
                              className="flex items-center gap-2 w-full py-0.5 text-xs hover:text-foreground text-muted-foreground"
                            >
                              <Checkbox checked={selectedTypes.has(type)} className="h-3 w-3" tabIndex={-1} />
                              <Icon className={`h-3 w-3 ${config.color}`} />
                              <span>{config.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasActiveFilters && (
                <>
                  <Separator />
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearFilters}>
                    <X className="h-3 w-3 mr-1" />
                    Clear all filters
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ScrollText className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-lg font-medium">No audit logs found</p>
              <p className="text-sm">{hasActiveFilters ? 'Try adjusting your filters' : 'Events will appear here as they occur'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByUser.map((group) => {
                const isCollapsed = collapsedUsers.has(group.userKey)
                return (
                  <Card key={group.userKey}>
                    <button
                      onClick={() => toggleUserCollapse(group.userKey)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors rounded-t-lg"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-semibold">{group.displayName}</span>
                      <Badge variant="secondary" className="text-[10px] ml-auto">
                        {group.logs.length} event{group.logs.length !== 1 ? 's' : ''}
                      </Badge>
                    </button>
                    {!isCollapsed && (
                      <CardContent className="px-4 pt-0 pb-2">
                        <div className="space-y-1">
                          {group.logs.map((log, i) => (
                            <AuditLogRow
                              key={log.id}
                              log={log}
                              displayName={group.displayName}
                              showDate={i === 0 || !isSameDay(group.logs[i - 1].createdAt.toDate(), log.createdAt.toDate())}
                            />
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
              {filteredLogs.length > visibleCount && (
                <div className="text-center pt-4">
                  <Button variant="outline" size="sm" onClick={() => setVisibleCount((p) => p + PAGE_SIZE)}>
                    Load more ({filteredLogs.length - visibleCount} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function AuditLogRow({ log, displayName, showDate }: { log: AuditLog; displayName: string; showDate: boolean }) {
  const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.project
  const Icon = config.icon
  const time = log.createdAt.toDate()

  const description = buildDescription(log)

  return (
    <>
      {showDate && (
        <div className="flex items-center gap-3 pt-3 pb-1">
          <span className="text-xs font-semibold text-muted-foreground">
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}
      <div className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group">
        <div className={`mt-0.5 ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{description}</span>
          </div>
          {log.details && Object.keys(log.details).length > 0 && (
            <div className="mt-0.5 flex items-center gap-2 flex-wrap">
              {Object.entries(log.details).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-[10px] font-normal">
                  {key}: {String(value)}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <Tooltip delayDuration={0}>
            <TooltipTrigger>
              <span className="text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</span>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {formatDateTime(log.createdAt)}
            </TooltipContent>
          </Tooltip>
          <div className="mt-0.5">
            <Badge variant="secondary" className={`text-[10px] ${config.color}`}>
              {config.label}
            </Badge>
          </div>
        </div>
      </div>
    </>
  )
}

function buildDescription(log: AuditLog): string {
  const target = log.targetName ? `"${log.targetName}"` : ''
  const project = log.projectName ? `in ${log.projectName}` : ''

  switch (log.type) {
    case 'login':
      return 'signed in'
    case 'login_failed':
      return `failed to sign in${log.details?.errorCode ? ` (${log.details.errorCode})` : ''}`
    case 'logout':
      return 'signed out'
    case 'project':
      return `${log.action} project ${target}`
    case 'task':
      return `${log.action} task ${target} ${project}`
    case 'comment':
      return `${log.action} comment ${project}`
    case 'feature':
      return `${log.action} feature ${target} ${project}`
    case 'vault':
      return `${log.action} vault entry ${target} ${project}`
    case 'permission':
      return `updated permissions for ${target} ${project}`
    case 'member':
      if (log.action === 'password_reset') return `reset password for ${target}`
      return `${log.action} member ${target}`
    case 'sharing':
      return `${log.action} sharing ${target} ${project}`
    case 'settings':
      return `updated settings${log.details?.field ? ` (${log.details.field})` : ''}`
    case 'media':
      return `${log.action} media ${target}`
    case 'payment':
      return `${log.action} payment ${target} ${project}`
    case 'calendar':
      return `${log.action} event ${target}`
    case 'attachment':
      return `${log.action} attachment ${target} ${project}`
    default:
      return `${log.action} ${target} ${project}`.trim()
  }
}
