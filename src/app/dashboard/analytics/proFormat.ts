/** Shared number/date formatting for the Pro dashboard. */

export const nf = new Intl.NumberFormat('de-DE');

/** Compact money: drops the cents when there are none (48.230 € vs 48.230,50 €). */
export const eur = (cents: number): string => {
  const digits = cents % 100 === 0 ? 0 : 2;
  return (cents / 100).toLocaleString('de-DE', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
};

export const eurExact = (cents: number): string =>
  (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

export const pct = (value: number): string => `${nf.format(value)} %`;

export const shortDate = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });

export const dayLabel = (iso: string): string =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });

export const shortWallet = (w: string): string => `${w.slice(0, 4)}…${w.slice(-4)}`;

/** "vor 3 Tagen" / "heute" — relative age of an ISO timestamp in whole days. */
export const relativeDays = (days: number): string => {
  if (days <= 0) return 'heute';
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
};

export const relativeTime = (iso: string): string => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  return relativeDays(Math.round(hours / 24));
};

/** Signed percentage, German formatting; `null` when there is no baseline. */
export const signedPct = (value: number | null, unit: '%' | 'pp' = '%'): string | null => {
  if (value == null) return null;
  const sign = value >= 0 ? '+' : '−';
  return `${sign}${nf.format(Math.abs(Math.round(value * 10) / 10))} ${unit}`;
};

/** Difference in percentage points, for shares that are already percentages. */
export const deltaPoints = (current: number, previous: number): number =>
  Math.round((current - previous) * 10) / 10;

/** Triggers a client-side CSV download; no server round-trip, no stored file. */
export function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const escape = (cell: string | number | null): string => {
    const value = cell == null ? '' : String(cell);
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  // Semicolons + BOM so Excel with German locale opens it without an import wizard.
  const csv = `﻿${rows.map((r) => r.map(escape).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
