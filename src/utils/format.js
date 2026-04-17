/**
 * EIT™ Formatting Utilities
 * =========================
 * Consistent formatting for numbers, percentages, durations, and dates.
 */

/** Format a ratio (0–1) as a percentage string, e.g. "87.5%" */
export function pct(value, decimals = 1) {
  if (!isFinite(value)) return '—';
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format a number with thousand separators, e.g. "12,345" */
export function num(value, decimals = 0) {
  if (!isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format currency, e.g. "$1,234.56" */
export function currency(value, decimals = 2) {
  if (!isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format minutes into "Xh Ym" or "Xm Ys" */
export function duration(minutes) {
  if (!isFinite(minutes) || minutes < 0) return '—';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (minutes >= 1) {
    const m = Math.floor(minutes);
    const s = Math.round((minutes - m) * 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${Math.round(minutes * 60)}s`;
}

/** Format a Date to "MMM DD, YYYY" */
export function dateStr(date) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format a Date to "MM/DD" for chart axis labels */
export function shortDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '—';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** Format a Date to "YYYY-MM-DD" for data keys */
export function isoDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  return date.toISOString().split('T')[0];
}

/** Compact large numbers: 12345 → "12.3K", 1234567 → "1.2M" */
export function compact(value) {
  if (!isFinite(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}
