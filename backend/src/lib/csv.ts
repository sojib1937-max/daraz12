// CSV helpers for import/export (products, orders, customers).
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

export function parseCsv(buffer: Buffer): Record<string, string>[] {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

export function toCsv(rows: Record<string, unknown>[]): string {
  return stringify(rows, { header: true });
}

export function csvDownload(res: { setHeader: (k: string, v: string) => void; send: (s: string) => void }, filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // BOM so Excel opens UTF-8 correctly
}
