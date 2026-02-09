/**
 * Parse a human-readable duration string into minutes.
 *
 * Supported formats:
 * - "2h 30m" or "2h30m"
 * - "90m"
 * - "1.5h"
 * - "1:30" (hours:minutes)
 * - "90" (bare number = minutes)
 */
export function parseDuration(input: string): number {
  const trimmed = input.trim();

  // Format: "1:30" (hours:minutes)
  const colonMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10);
    const mins = parseInt(colonMatch[2], 10);
    return Math.max(1, hours * 60 + mins);
  }

  // Format: "2h 30m", "2h30m", "2h", "30m", "1.5h"
  const hasUnits = /[hm]/i.test(trimmed);
  if (hasUnits) {
    let totalMinutes = 0;

    const hoursMatch = trimmed.match(/([\d.]+)\s*h/i);
    if (hoursMatch) {
      totalMinutes += Math.round(parseFloat(hoursMatch[1]) * 60);
    }

    const minsMatch = trimmed.match(/([\d.]+)\s*m/i);
    if (minsMatch) {
      totalMinutes += Math.round(parseFloat(minsMatch[1]));
    }

    return Math.max(1, totalMinutes);
  }

  // Bare number = minutes
  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return Math.max(1, Math.round(num));
  }

  throw new Error(`Cannot parse duration: "${input}". Use formats like "2h 30m", "90m", "1.5h", "1:30", or a number of minutes.`);
}
