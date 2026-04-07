'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from './useToast'

const CHECK_INTERVAL_MS = 15_000
const PING_TIMEOUT_MS = 5_000

export function useOfflineDetector() {
  const [isOffline, setIsOffline] = useState(false)
  const wasOfflineRef = useRef(false)

  const showOffline = useCallback(() => {
    if (wasOfflineRef.current) return
    wasOfflineRef.current = true
    setIsOffline(true)
    toast({
      title: 'You are offline',
      description: 'Some features may not work until your connection is restored.',
      variant: 'destructive',
    })
  }, [])

  const showOnline = useCallback(() => {
    if (!wasOfflineRef.current) return
    wasOfflineRef.current = false
    setIsOffline(false)
    toast({
      title: 'Back online',
      description: 'Your connection has been restored.',
    })
  }, [])

  const checkConnectivity = useCallback(async () => {
    if (!navigator.onLine) {
      showOffline()
      return
    }

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS)
      await fetch('https://www.gstatic.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      showOnline()
    } catch {
      showOffline()
    }
  }, [showOffline, showOnline])

  useEffect(() => {
    checkConnectivity()

    const handleOffline = () => showOffline()
    const handleOnline = () => checkConnectivity()

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    const interval = setInterval(checkConnectivity, CHECK_INTERVAL_MS)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  }, [checkConnectivity, showOffline])

  return isOffline
}
