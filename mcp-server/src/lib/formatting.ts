import { Timestamp } from 'firebase-admin/firestore';

/**
 * Format minutes into a human-readable duration string.
 * e.g. 150 → "2h 30m", 45 → "45m", 0 → "0m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format a Firestore Timestamp to a time string like "14:30".
 */
export function formatTime(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a Firestore Timestamp to a date string like "2025-01-15".
 */
export function formatDate(timestamp: Timestamp): string {
  const date = timestamp.toDate();
  return date.toISOString().split('T')[0];
}

/**
 * Calculate elapsed minutes between a start Timestamp and now.
 */
export function elapsedMinutes(startTime: Timestamp): number {
  const now = Date.now();
  const start = startTime.toMillis();
  return Math.round((now - start) / 60000);
}
