'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const mainNavItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/time', label: 'Time Tracking', icon: Clock },
  { href: '/finances', label: 'Finances', icon: Wallet },
]

const secondaryNavItems = [
  { href: '/media', label: 'Media Library', icon: FolderOpen },
  { href: '/assistant', label: 'AI Assistant', icon: Sparkles },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-[width] duration-300 ease-in-out overflow-hidden',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col w-64">
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
            <span
              className={cn(
                'text-xl font-bold whitespace-nowrap transition-opacity duration-200',
                collapsed ? 'opacity-0' : 'opacity-100 delay-100'
              )}
            >
              WorkHub
            </span>
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

          {/* Separator */}
          <div className="my-3 px-3">
            <div className="h-px bg-border" />
          </div>

          {/* Secondary Navigation */}
          <div className="space-y-1">
            {secondaryNavItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href))
              const isAI = item.href === '/assistant'

              const navLink = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isAI
                      ? isActive
                        ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white'
                        : 'text-purple-600 dark:text-purple-400 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-blue-500/10'
                      : isActive
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
        </nav>

        {/* Settings & Collapse */}
        <div className="border-t p-2 space-y-1">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-5 w-5 flex-shrink-0" />
                  <span className="whitespace-nowrap opacity-0">Settings</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                Settings
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'whitespace-nowrap transition-opacity duration-200',
                  collapsed ? 'opacity-0' : 'opacity-100 delay-100'
                )}
              >
                Settings
              </span>
            </Link>
          )}

          <Button
            variant="ghost"
            onClick={onToggle}
            className="w-full justify-start gap-3"
          >
            <span className="flex-shrink-0">
              {collapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </span>
            <span
              className={cn(
                'whitespace-nowrap transition-opacity duration-200',
                collapsed ? 'opacity-0' : 'opacity-100 delay-100'
              )}
            >
              Collapse
            </span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
