const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['week', 1000 * 60 * 60 * 24 * 7],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
];

// numeric: 'always' keeps output as "1 day ago" / "1 week ago" (matching the
// prototype's sample copy) instead of Intl's idiomatic "yesterday" / "last week".
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'always' });

export function relativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = date.getTime() - now.getTime();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'just now';
}

export function formatLoc(n: number): string {
  return n.toLocaleString('en-US');
}
