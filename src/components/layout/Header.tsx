'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useProject } from '@/hooks/useProjects'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Avatar, AvatarFallback, CachedAvatarImage } from '@/components/ui/avatar'
import { Moon, Sun, LogOut, User, Bell, BellOff, ChevronRight, Info, Edit, Trash2, FolderKanban, Building2, Link2 } from 'lucide-react'
import { useThemeContext } from '@/components/layout/ThemeProvider'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'
import { ProjectIcon } from '@/components/projects/ProjectImagePicker'
import { formatCurrency, projectTypes, statusColors, getEffectiveTotal, calculateProgress, cn } from '@/lib/utils'

/** Pull a `/projects/<id>` id from the current path, or null if not a project route. */
function useProjectIdFromPath(): string | null {
  const pathname = usePathname()
  return useMemo(() => {
    const m = pathname?.match(/^\/projects\/([^/?#]+)/)
    if (!m) return null
    if (m[1] === 'new') return null
    return m[1]
  }, [pathname])
}

/** Static page titles shown in the header for non-project routes (longest prefix wins). */
const PAGE_TITLES: { prefix: string; title: string; subtitle?: string }[] = [
  { prefix: '/projects/new', title: 'New Project', subtitle: 'Create a new project' },
  { prefix: '/projects', title: 'Projects', subtitle: 'Manage and track all your projects' },
  { prefix: '/finances', title: 'Finances', subtitle: 'Track payments and financial overview' },
  { prefix: '/media', title: 'Media Library' },
  { prefix: '/time/entries', title: 'All Time Entries' },
  { prefix: '/time', title: 'Time Tracking', subtitle: 'Track and analyze your work time' },
  { prefix: '/team', title: 'Team', subtitle: 'Manage your team members' },
  { prefix: '/calendar', title: 'Calendar' },
  { prefix: '/audit-logs', title: 'Audit Logs' },
  { prefix: '/settings', title: 'Settings', subtitle: 'Manage your account and preferences' },
  { prefix: '/image-generator', title: 'Image Generator' },
  { prefix: '/assistant', title: 'AI Assistant' },
  { prefix: '/', title: 'Dashboard', subtitle: "Welcome back! Here's your work overview." },
]

function PageTitleBlock() {
  const pathname = usePathname() ?? '/'
  const entry = PAGE_TITLES.find((e) =>
    e.prefix === '/' ? pathname === '/' : pathname.startsWith(e.prefix))
  if (!entry) return null
  return (
    <div className="min-w-0">
      <h1 className="truncate text-lg font-semibold leading-tight tracking-tight">{entry.title}</h1>
      {entry.subtitle && (
        <p className="truncate text-xs leading-tight text-muted-foreground">{entry.subtitle}</p>
      )}
    </div>
  )
}

function ProjectContextBlock({ projectId }: { projectId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, parentProject, subProjects } = useProject(projectId)
  if (!project) return null

  const isInternal = project.paymentModel === 'internal'
  const isMonthly = project.paymentModel === 'monthly'
  const effectiveTotal = getEffectiveTotal(project)
  const owedAmount = isInternal
    ? 0
    : Math.max(0, effectiveTotal - project.paidAmount)
  const progress = isMonthly || isInternal
    ? 0
    : calculateProgress(project.paidAmount, effectiveTotal)
  const typeLabel = project.projectType && project.projectType !== 'other'
    ? projectTypes.find((t) => t.value === project.projectType)?.label
    : null

  const openDialog = (which: 'edit' | 'subprojects' | 'delete') => {
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('dialog', which)
    router.push(`/projects/${projectId}?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="flex items-center justify-center rounded-lg p-2 shrink-0"
        style={{
          backgroundColor: `color-mix(in srgb, ${project.color || '#6B8DD6'} 18%, transparent)`,
        }}
      >
        <ProjectIcon src={project.coverImageUrl} name={project.name} size="sm" />
      </div>
      <div className="flex items-center gap-1 min-w-0">
        {parentProject && (
          <>
            <Link
              href={`/projects/${parentProject.id}`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors max-w-[140px] truncate"
            >
              {parentProject.name}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </>
        )}
        <span className="text-lg font-semibold tracking-tight truncate">{project.name}</span>
        {!isInternal && project.clientName && (
          <span className="ml-1 text-sm text-muted-foreground hidden md:inline">· {project.clientName}</span>
        )}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Project details">
            <Info className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-96">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">{project.name}</h3>
                {!isInternal && project.clientName && (
                  <span className="text-xs text-primary font-medium">· {project.clientName}</span>
                )}
                {typeLabel && (
                  <span className="text-xs text-muted-foreground">· {typeLabel}</span>
                )}
              </div>
              {project.description && (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                  {project.description}
                </p>
              )}
            </div>

            {!isInternal && project.hasOwnFinances !== false && (
              <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                <div>
                  <p className="text-muted-foreground">{isMonthly ? 'Rate' : 'Total'}</p>
                  <p className="font-semibold">{formatCurrency(effectiveTotal)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isMonthly ? 'Received' : 'Paid'}</p>
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    {formatCurrency(project.paidAmount)}
                    {!isMonthly && <span className="ml-1 text-muted-foreground font-normal">({progress}%)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{isMonthly ? 'Pending' : 'Owed'}</p>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">{formatCurrency(owedAmount)}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className={cn('text-xs', statusColors.project[project.status])}>
                {project.status}
              </Badge>
              {isInternal && (
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-0 text-xs">
                  <Building2 className="h-3 w-3 mr-1" />
                  Internal
                </Badge>
              )}
              {parentProject && !project.hasOwnFinances && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-0 text-xs">
                  <Link2 className="h-3 w-3 mr-1" />
                  Shared finances
                </Badge>
              )}
            </div>

          </div>
        </PopoverContent>
      </Popover>

      {/* Edit — same design language as Sub-Projects */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openDialog('edit')}
        className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        title="Edit project"
        aria-label="Edit project"
      >
        <Edit className="h-4 w-4" />
        <span className="text-xs font-medium">Edit</span>
      </Button>

      {/* Sub-Projects — first-class header action for root projects */}
      {!project.parentProjectId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openDialog('subprojects')}
          className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          title="Sub-Projects"
          aria-label="Open sub-projects"
        >
          <FolderKanban className="h-4 w-4" />
          <span className="text-xs font-medium">Sub-Projects</span>
          {subProjects.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums">
              {subProjects.length}
            </span>
          )}
        </Button>
      )}

      {/* Delete — same design language, destructive on hover */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openDialog('delete')}
        className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-destructive"
        title="Delete project"
        aria-label="Delete project"
      >
        <Trash2 className="h-4 w-4" />
        <span className="text-xs font-medium">Delete</span>
      </Button>
    </div>
  )
}

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useThemeContext()
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const projectId = useProjectIdFromPath()

  useEffect(() => {
    setNotifPermission(getNotificationPermission())
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const handleNotificationClick = async () => {
    if (notifPermission === 'granted') {
      router.push('/settings?tab=notifications')
      return
    }
    if (notifPermission === 'unsupported') return
    const granted = await requestNotificationPermission()
    setNotifPermission(granted ? 'granted' : 'denied')
    if (granted) {
      router.push('/settings?tab=notifications')
    }
  }

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      {/* Left: project context on a project page, page title elsewhere */}
      <div className="flex items-center gap-2 min-w-0">
        {projectId ? <ProjectContextBlock projectId={projectId} /> : <PageTitleBlock />}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* Page-injected actions (HeaderActions portal) */}
        <div id="header-actions-slot" className="mr-3 flex items-center gap-2 empty:mr-0" />
        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNotificationClick}
          className="relative h-9 w-9"
          title={
            notifPermission === 'granted'
              ? 'Notifications enabled'
              : notifPermission === 'denied'
                ? 'Notifications blocked — update in browser settings'
                : notifPermission === 'unsupported'
                  ? 'Notifications not supported'
                  : 'Click to enable notifications'
          }
        >
          {notifPermission === 'granted' ? (
            <>
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
            </>
          ) : notifPermission === 'denied' || notifPermission === 'unsupported' ? (
            <BellOff className="h-[18px] w-[18px] text-muted-foreground" />
          ) : (
            <>
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            </>
          )}
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
          {resolvedTheme === 'dark' ? (
            <Sun className="h-[18px] w-[18px]" />
          ) : (
            <Moon className="h-[18px] w-[18px]" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative ml-1.5 h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <CachedAvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.displayName || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings?tab=account')}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
