export interface CsvColumn<T> {
  header: string
  value: (row: T) => string | number | boolean | null | undefined
}

function escapeCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build CSV text (no BOM). */
export function toCsv<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const head = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => escapeCell(c.value(r))).join(','))
  return [head, ...body].join('\r\n')
}

/**
 * Download rows as CSV with a UTF-8 BOM so Excel shows Vietnamese correctly.
 *   exportCsv('merchants.csv', [{ header: 'Mã', value: m => m.code }], rows)
 */
export function exportCsv<T>(filename: string, columns: CsvColumn<T>[], rows: T[]): void {
  const blob = new Blob(['﻿', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
