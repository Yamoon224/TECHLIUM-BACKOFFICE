/**
 * Pure helpers of the data tables: sorting, paging, and the text formats of
 * the exports. No React and no browser here, so all of it is unit-tested.
 */

export const PAGE_SIZES = [10, 20, 30, 50, 100, "all"] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
export type SortDirection = "asc" | "desc";

/** One cell's text, as the user sees it (NBSP and runs of spaces collapsed). */
export function cleanText(text: string): string {
  return text.replace(/[  ]/g, " ").replace(/\s+/g, " ").trim();
}

/** "118 000 F CFA" -> 118000, "12,5 %" -> 12.5, "−5" -> -5; null when it is not a number. */
export function parseNumber(text: string): number | null {
  const cleaned = cleanText(text)
    .replace(/[−–]/g, "-")
    .replace(/\s?(F ?CFA|XOF|XAF|EUR|USD|%|€|\$)$/i, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** "27/10/2026" or "27/10/2026 14:30" -> a sortable timestamp; null when it is not a date. */
export function parseDate(text: string): number | null {
  const match = cleanText(text).match(/^(\d{2})\/(\d{2})\/(\d{4})(?: (\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, day, month, year, hour = "0", minute = "0"] = match;
  return Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

/** Numbers and dates compare as such, everything else as text with natural ordering; empty cells always sort last. */
export function compareCells(a: string, b: string): number {
  const x = cleanText(a);
  const y = cleanText(b);

  if (x === "" && y === "") return 0;
  if (x === "") return 1;
  if (y === "") return -1;

  const numberX = parseNumber(x);
  const numberY = parseNumber(y);
  if (numberX !== null && numberY !== null) return numberX - numberY;

  const dateX = parseDate(x);
  const dateY = parseDate(y);
  if (dateX !== null && dateY !== null) return dateX - dateY;

  return x.localeCompare(y, "fr", { numeric: true, sensitivity: "base" });
}

/** Row indexes in display order: stable sort on one column, or the original order when there is no sort. */
export function sortedIndexes(values: readonly (readonly string[])[], column: number | null, direction: SortDirection): number[] {
  const indexes = values.map((_, index) => index);
  if (column === null) return indexes;

  const factor = direction === "asc" ? 1 : -1;
  return indexes.sort((a, b) => {
    const result = compareCells(values[a][column] ?? "", values[b][column] ?? "");
    // Empty cells stay last whichever the direction.
    const aEmpty = (values[a][column] ?? "") === "";
    const bEmpty = (values[b][column] ?? "") === "";
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
    return result * factor || a - b;
  });
}

/** Lower-case, accent-free text, so "Électro" is found by "electro". */
export function searchKey(text: string): string {
  return cleanText(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Rows (by index) with at least one of the given columns containing every word
 * of the query, in any order. An empty query keeps every row. A word with digits also
 * matches across thousands separators, so "118000" finds "118 000 F CFA".
 */
export function matchingIndexes(values: readonly (readonly string[])[], columns: readonly number[], query: string): number[] {
  const words = searchKey(query).split(" ").filter(Boolean);
  const indexes = values.map((_, index) => index);
  if (words.length === 0) return indexes;

  return indexes.filter((index) => {
    const haystack = columns.map((column) => searchKey(values[index][column] ?? "")).join(" ");
    // Amounts are shown with thousands separators ("118 000"): "118000" must find them too.
    const compact = haystack.replace(/ /g, "");
    return words.every((word) => haystack.includes(word) || (/\d/.test(word) && compact.includes(word)));
  });
}

/** The next sort state when a header is clicked: ascending, then descending, then none. */
export function nextSort(current: { column: number | null; direction: SortDirection }, clicked: number): { column: number | null; direction: SortDirection } {
  if (current.column !== clicked) return { column: clicked, direction: "asc" };
  if (current.direction === "asc") return { column: clicked, direction: "desc" };
  return { column: null, direction: "asc" };
}

export interface PageWindow {
  page: number;
  pageCount: number;
  start: number;
  end: number;
}

/** Which rows are on a page (1-based, clamped into range); "all" is a single page. */
export function pageWindow(total: number, size: PageSize, page: number): PageWindow {
  if (size === "all" || total === 0) return { page: 1, pageCount: 1, start: 0, end: total };

  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * size;

  return { page: current, pageCount, start, end: Math.min(total, start + size) };
}

/** Items displayed from the first page up to and including the current one. */
export function shownThroughPage(total: number, window: PageWindow): number {
  return Math.min(total, window.end);
}

// ---------------------------------------------------------------- exports

function csvField(value: string): string {
  return /[",;\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Comma-separated values, quoted where needed. The leading BOM is added by the saver, not here. */
export function toCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");
}

/** Tab-separated text, one row per line (tabs and newlines inside a cell become spaces). */
export function toTxt(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const flat = (value: string) => value.replace(/[\t\r\n]+/g, " ");
  return [headers, ...rows].map((row) => row.map(flat).join("\t")).join("\n");
}

/** A safe SQL identifier: lower-case letters, digits and underscores, never starting with a digit. */
export function sqlIdentifier(name: string): string {
  const base = cleanText(name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return /^[a-z_]/.test(base) ? base : `c_${base || "col"}`;
}

/** Unique identifiers for the column names (two identical headers get _2, _3...). */
export function uniqueIdentifiers(headers: readonly string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const id = sqlIdentifier(header);
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    return count === 1 ? id : `${id}_${count}`;
  });
}

function sqlValue(value: string): string {
  const text = cleanText(value);
  if (text === "") return "NULL";

  const number = parseNumber(text);
  // An amount or plain number stays a number (a leading zero, like a phone number, stays text).
  if (number !== null && !/^-?0\d/.test(text)) return String(number);

  return `'${text.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
}

/** A CREATE TABLE followed by one INSERT per row (MySQL-compatible; every column is TEXT-safe through VARCHAR/TEXT). */
export function toSql(table: string, headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const name = sqlIdentifier(table);
  const columns = uniqueIdentifiers(headers);
  const create = `CREATE TABLE IF NOT EXISTS \`${name}\` (\n${columns.map((column) => `  \`${column}\` TEXT NULL`).join(",\n")}\n);`;
  const columnList = columns.map((column) => `\`${column}\``).join(", ");
  const inserts = rows.map((row) => `INSERT INTO \`${name}\` (${columnList}) VALUES (${columns.map((_, index) => sqlValue(row[index] ?? "")).join(", ")});`);

  return [create, ...inserts].join("\n");
}

/** jsPDF's built-in fonts only cover Latin-1: anything else is replaced so the PDF never shows garbage. */
export function toLatin1(text: string): string {
  return cleanText(text).replace(/[^ -ÿ]/g, "?");
}
