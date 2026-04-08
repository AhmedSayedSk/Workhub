'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useSettings } from '@/hooks/useSettings'
import { useModulePermissions } from '@/hooks/usePermissions'
import {
  LayoutDashboard,
  FolderKanban,
  Clock,
  Wallet,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  FolderOpen,
  Users,
  ExternalLink,
  CalendarDays,
  Wand2,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const allMainNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/team', label: 'Team', icon: Users, ownerOnly: true },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, moduleKey: 'viewCalendar' as const },
  { href: '/media', label: 'Media Library', icon: FolderOpen, moduleKey: 'viewMedia' as const },
]

const trackingNavItems = [
  { href: '/time', label: 'Timesheets', icon: Clock, moduleKey: 'viewTimesheets' as const },
  { href: '/finances', label: 'Invoices & Payments', icon: Wallet, moduleKey: 'viewFinances' as const },
]

const aiNavItems = [
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles, moduleKey: 'accessAiAssistant' as const },
  { href: '/image-generator', label: 'Image Generator', icon: Wand2, moduleKey: 'accessImageGenerator' as const },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { settings } = useSettings()
  const { canModule } = useModulePermissions()
  const isAppOwner = !!(user && settings?.appOwnerUid && user.uid === settings.appOwnerUid)

  const mainNavItems = useMemo(() =>
    allMainNavItems.filter((item) => {
      if (item.ownerOnly && !isAppOwner) return false
      if (item.moduleKey && !canModule(item.moduleKey)) return false
      return true
    }),
    [isAppOwner, canModule]
  )

  const filteredTrackingNavItems = useMemo(() =>
    trackingNavItems.filter((item) => !item.moduleKey || canModule(item.moduleKey)),
    [canModule]
  )

  const filteredAiNavItems = useMemo(() =>
    aiNavItems.filter((item) => !item.moduleKey || canModule(item.moduleKey)),
    [canModule]
  )

  const hasFullSettings = canModule('accessSettings')

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-[width] duration-300 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn("flex h-full flex-col transition-[width] duration-300 ease-in-out", collapsed ? "w-16" : "w-64")}>
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="WorkHub"
              width={32}
              height={32}
              className="h-8 w-8 flex-shrink-0"
            />
            <div
              className={cn(
                'flex flex-col whitespace-nowrap transition-opacity duration-200',
                collapsed ? 'opacity-0' : 'opacity-100 delay-100'
              )}
            >
              <span className="text-xl font-bold leading-tight">WorkHub</span>
              <span className="text-[10px] text-muted-foreground leading-tight">Sikasio Works</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 overflow-hidden">
          <div className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              const navLink = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-200',
                      collapsed ? 'opacity-0' : 'opacity-100 delay-100'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return navLink
            })}
          </div>

          {/* Tracking Section */}
          {filteredTrackingNavItems.length > 0 && (
          <>
          <div className="my-3 px-3">
            <div className="h-px bg-border" />
          </div>
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tracking
                </span>
              </div>
            )}
            {filteredTrackingNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              const navLink = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-200',
                      collapsed ? 'opacity-0' : 'opacity-100 delay-100'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return navLink
            })}
          </div>
          </>
          )}

          {/* AI Studio Section */}
          {filteredAiNavItems.length > 0 && (
          <>
          <div className="my-3 px-3">
            <div className="h-px bg-border" />
          </div>
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-3 pb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  AI Studio
                </span>
              </div>
            )}
            {filteredAiNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))

              const navLink = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span
                    className={cn(
                      'whitespace-nowrap transition-opacity duration-200',
                      collapsed ? 'opacity-0' : 'opacity-100 delay-100'
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.href} delayDuration={0}>
                    <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                )
              }

              return navLink
            })}
          </div>
          </>
          )}
        </nav>

        {/* Settings & Collapse */}
        <div className="border-t p-2 space-y-1 overflow-hidden">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {hasFullSettings ? <Settings className="h-5 w-5 flex-shrink-0" /> : <User className="h-5 w-5 flex-shrink-0" />}
                  <span className="whitespace-nowrap opacity-0">{hasFullSettings ? 'Settings' : 'Profile'}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {hasFullSettings ? 'Settings' : 'Profile'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {hasFullSettings ? <Settings className="h-5 w-5 flex-shrink-0" /> : <User className="h-5 w-5 flex-shrink-0" />}
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity duration-200',
                  collapsed ? 'opacity-0' : 'opacity-100 delay-100'
                )}
              >
                {hasFullSettings ? 'Settings' : 'Profile'}
              </span>
            </Link>
          )}

          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={onToggle}
                  className="w-full justify-start gap-3 px-3 py-2.5 h-auto"
                >
                  <span className="flex-shrink-0">
                    <ChevronRight className="h-5 w-5" />
                  </span>
                  <span className="whitespace-nowrap opacity-0">Expand</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Expand
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={onToggle}
              className="w-full justify-start gap-3 px-3 py-2.5 h-auto"
            >
              <span className="flex-shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </span>
              <span className="whitespace-nowrap transition-opacity duration-200 opacity-100 delay-100">
                Collapse
              </span>
            </Button>
          )}
        </div>

        {/* Sikasio link */}
        <div className="border-t px-4 py-2 overflow-hidden">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <a
                  href="https://sikasio.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                sikasio.com
              </TooltipContent>
            </Tooltip>
          ) : (
            <a
              href="https://sikasio.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <span>Support us & see more at sikasio.com</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </aside>
  )
}
