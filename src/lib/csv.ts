/**
 * CSV for the reports' downloads, readable by Excel, Numbers and Google
 * Sheets.
 *
 * Two rules that matter:
 *
 *   Fields with a comma, quote or line break are quoted, quotes doubled.
 *
 *   A text cell that starts with = + - @ (or a tab or carriage return) is
 *   prefixed with an apostrophe. Names and addresses come from customers; a
 *   "name" of =HYPERLINK(...) must not become a formula when the office opens
 *   the file (CSV injection). Numbers are written as numbers, untouched.
 */

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CRLF line ends and a byte-order mark, so Excel reads accents and £ correctly. */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => cell(column.header)).join(","),
    ...rows.map((row) => columns.map((column) => cell(column.value(row))).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
