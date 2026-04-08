'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, CachedAvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search, Moon, Sun, LogOut, User, Bell, BellOff } from 'lucide-react'
import { useThemeContext } from '@/components/layout/ThemeProvider'
import { getNotificationPermission, requestNotificationPermission } from '@/lib/notifications'

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useThemeContext()
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default')

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
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects, tasks..."
            className="pl-10 bg-muted/50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNotificationClick}
          className="relative"
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
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
            </>
          ) : notifPermission === 'denied' || notifPermission === 'unsupported' ? (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          ) : (
            <>
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            </>
          )}
        </Button>

        {/* Theme Toggle */}
        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {resolvedTheme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
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
