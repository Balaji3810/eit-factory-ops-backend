/**
 * EIT™ CSV Export Utility
 * =======================
 * Generates CSV content and triggers browser download.
 */

/**
 * Convert an array of objects to a CSV string.
 * @param {Object[]} rows - data rows
 * @param {string[]} [columns] - ordered column keys (defaults to all keys in first row)
 * @param {Object} [labels] - optional column key → display label map
 */
export function toCSV(rows, columns, labels = {}) {
  if (!rows || rows.length === 0) return '';
  const cols = columns || Object.keys(rows[0]);
  const header = cols.map((c) => labels[c] || c).join(',');
  const body = rows.map((row) =>
    cols.map((c) => {
      const val = row[c];
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Escape fields containing commas, quotes, or newlines
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','),
  ).join('\n');
  return `${header}\n${body}`;
}

/**
 * Trigger a browser download of a CSV file.
 */
export function downloadCSV(csvContent, filename = 'export.csv') {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
