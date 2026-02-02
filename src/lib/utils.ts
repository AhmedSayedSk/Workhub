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

// Color utilities - Softer, muted colors for dark mode comfort
export const systemColors = [
  { name: 'Blue', value: '#6B8DD6' },
  { name: 'Green', value: '#5BA67C' },
  { name: 'Purple', value: '#9B7DC9' },
  { name: 'Orange', value: '#D49556' },
  { name: 'Pink', value: '#C97BA3' },
  { name: 'Teal', value: '#5BA6A0' },
  { name: 'Red', value: '#C97575' },
  { name: 'Yellow', value: '#C9B56B' },
  { name: 'Indigo', value: '#8385C9' },
  { name: 'Cyan', value: '#5BAAB5' },
]

// Chart colors - softer palette for dark mode
export const chartColors = [
  '#6B8DD6', // soft blue
  '#5BA67C', // soft green
  '#9B7DC9', // soft purple
  '#D49556', // soft orange
  '#C97BA3', // soft pink
  '#5BA6A0', // soft teal
]

export function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16)
  const g = parseInt(hexColor.slice(3, 5), 16)
  const b = parseInt(hexColor.slice(5, 7), 16)

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

// Status color mapping - softer tones for both light and dark modes
export const statusColors = {
  project: {
    active: 'bg-green-500/8 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/15 dark:border-green-500/20',
    paused: 'bg-amber-500/8 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/15 dark:border-amber-500/20',
    completed: 'bg-blue-500/8 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-500/15 dark:border-blue-500/20',
    cancelled: 'bg-red-500/8 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-500/15 dark:border-red-500/20',
  },
  task: {
    todo: 'bg-slate-500/8 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-500/15 dark:border-slate-500/20',
    in_progress: 'bg-blue-500/8 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-500/15 dark:border-blue-500/20',
    review: 'bg-purple-500/8 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border-purple-500/15 dark:border-purple-500/20',
    done: 'bg-green-500/8 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/15 dark:border-green-500/20',
  },
  priority: {
    low: 'bg-slate-500/8 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-500/15 dark:border-slate-500/20',
    medium: 'bg-amber-500/8 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/15 dark:border-amber-500/20',
    high: 'bg-red-500/8 text-red-700 dark:bg-red-500/10 dark:text-red-400 border-red-500/15 dark:border-red-500/20',
  },
  milestone: {
    pending: 'bg-slate-500/8 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border-slate-500/15 dark:border-slate-500/20',
    completed: 'bg-blue-500/8 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border-blue-500/15 dark:border-blue-500/20',
    paid: 'bg-green-500/8 text-green-700 dark:bg-green-500/10 dark:text-green-400 border-green-500/15 dark:border-green-500/20',
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
