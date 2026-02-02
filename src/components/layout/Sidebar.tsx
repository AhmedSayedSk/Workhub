'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Briefcase,
  LayoutDashboard,
  FolderKanban,
  Clock,
  Wallet,
  Layers,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/systems', label: 'Systems', icon: Layers },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/time', label: 'Time Tracking', icon: Clock },
  { href: '/finances', label: 'Finances', icon: Wallet },
]

interface SidebarProps {
  onOpenAI?: () => void
}

export function Sidebar({ onOpenAI }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">WorkHub</span>
            </Link>
          )}
          {collapsed && (
            <Briefcase className="h-6 w-6 text-primary" />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => {
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
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  collapsed && 'justify-center px-2'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
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
        </nav>

        {/* AI Assistant Quick Access */}
        <div className="p-2">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-full bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-500/20 dark:from-purple-400/10 dark:to-blue-400/10 dark:hover:from-purple-400/15 dark:hover:to-blue-400/15 dark:border-purple-400/20"
                  onClick={onOpenAI}
                >
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                AI Assistant (Ctrl+K)
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-500/20 dark:from-purple-400/10 dark:to-blue-400/10 dark:hover:from-purple-400/15 dark:hover:to-blue-400/15 dark:border-purple-400/20"
              onClick={onOpenAI}
            >
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-700 dark:text-purple-400">AI Assistant</span>
              <kbd className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">Ctrl+K</kbd>
            </Button>
          )}
        </div>

        {/* Settings & Collapse */}
        <div className="border-t p-2 space-y-1">
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link
                  href="/settings"
                  className="flex items-center justify-center rounded-lg px-2 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Settings className="h-5 w-5" />
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
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>
          )}

          <Button
            variant="ghost"
            size={collapsed ? 'icon' : 'default'}
            onClick={() => setCollapsed(!collapsed)}
            className={cn('w-full', !collapsed && 'justify-start gap-3')}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Collapse</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </aside>
  )
}
