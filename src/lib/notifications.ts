/**
 * Browser Notifications API utility
 */

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported'
  }
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendBrowserNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string }
): void {
  if (getNotificationPermission() !== 'granted') return
  new Notification(title, {
    icon: '/favicon.ico',
    ...options,
  })
}
