// Tiny CSV helper: turn tabular data into a downloadable file so field teams
// can pull war-room ward lists straight into a spreadsheet or VAN import.

type Cell = string | number | null | undefined;

/** Escape a single cell per RFC 4180 (quote if it contains comma, quote, or newline). */
function escapeCell(value: Cell): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    if (/[",\n\r]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/** Build a CSV string from a header row and body rows. */
export function toCsv(headers: string[], rows: Cell[][]): string {
    const lines = [headers, ...rows].map(row => row.map(escapeCell).join(','));
    return lines.join('\r\n');
}

/** Trigger a browser download of `csv` as `filename`. No-op outside the browser. */
export function downloadCsv(filename: string, csv: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    // Prepend a UTF-8 BOM (U+FEFF) so Excel opens the file as UTF-8.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick so the click has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Slugify a label into a filename-safe token, e.g. "Assembly District 76" → "assembly-district-76". */
export function fileSlug(label: string): string {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'export';
}
