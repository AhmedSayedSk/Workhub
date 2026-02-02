import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInMinutes } from 'date-fns'
import { Timestamp } from 'firebase/firestore'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting helpers
export function formatDate(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, 'MMM d, yyyy')
}

export function formatDateTime(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, 'MMM d, yyyy HH:mm')
}

export function formatTime(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, 'HH:mm')
}

export function formatRelativeTime(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function formatMonth(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, 'MMMM yyyy')
}

export function formatMonthShort(date: Date | Timestamp): string {
  const d = date instanceof Timestamp ? date.toDate() : date
  return format(d, 'MMM yyyy')
}

// Duration formatting
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours === 0) {
    return `${mins}m`
  }

  if (mins === 0) {
    return `${hours}h`
  }

  return `${hours}h ${mins}m`
}

export function formatDurationLong(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`)
  }

  if (mins > 0) {
    parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`)
  }

  return parts.join(' ') || '0 minutes'
}

export function formatTimerDisplay(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  return `${pad(minutes)}:${pad(seconds)}`
}

// Currency formatting
export function formatCurrency(amount: number, currency: string = 'EGP'): string {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Percentage formatting
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`
}

// Calculate progress
export function calculateProgress(current: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.round((current / total) * 100))
}

// Convert Timestamp to Date
export function toDate(timestamp: Timestamp | Date | null): Date | null {
  if (!timestamp) return null
  return timestamp instanceof Timestamp ? timestamp.toDate() : timestamp
}

// Get difference in minutes between two dates
export function getMinutesBetween(start: Date | Timestamp, end: Date | Timestamp): number {
  const startDate = start instanceof Timestamp ? start.toDate() : start
  const endDate = end instanceof Timestamp ? end.toDate() : end
  return differenceInMinutes(endDate, startDate)
}

// Color utilities
export const systemColors = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Cyan', value: '#06B6D4' },
]

export function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

// Status color mapping
export const statusColors = {
  project: {
    active: 'bg-green-500/10 text-green-600 border-green-500/20',
    paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  task: {
    todo: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    in_progress: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    review: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    done: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  priority: {
    low: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    high: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
  milestone: {
    pending: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    paid: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
}

// Debounce utility
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Generate unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15)
}
