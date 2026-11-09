"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Search, X } from "lucide-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  cleanText,
  matchingIndexes,
  nextSort,
  PAGE_SIZES,
  pageWindow,
  shownThroughPage,
  sortedIndexes,
  type PageSize,
  type SortDirection,
} from "@/lib/datatable";
import { exportTable, type ExportFormat } from "@/lib/exporters";
import { AppearanceContext, useAppearance } from "./AppearanceProvider";

const EXPORTS: { format: ExportFormat; label: string }[] = [
  { format: "pdf", label: "PDF" },
  { format: "xlsx", label: "Excel" },
  { format: "csv", label: "CSV" },
  { format: "txt", label: "TXT" },
  { format: "sql", label: "SQL" },
];

interface DataTableProps<T> {
  /** File / SQL table name of the exports, e.g. "commandes". */
  name: string;
  /** Title printed on the PDF; defaults to the name. */
  title?: string;
  rows: readonly T[];
  /** Column titles, already translated. */
  headers: readonly string[];
  /** Columns that hold buttons rather than data: not sortable, not exported. */
  actionColumns?: readonly number[];
  /** The row's `<tr>`s (several for a row with a detail row); sorting and exports read the first `<tr>`'s cells. */
  renderRow: (row: T, index: number) => ReactNode;
  /** Always-visible rows under the data (totals): not sorted, paged or exported. */
  footer?: ReactNode;
  className?: string;
}

/**
 * A table with sortable columns (ascending, descending, none), paging
 * (10, 20, 30, 50, 100 or all), a footer with the pager and the item count, and
 * export buttons (PDF, Excel, CSV, TXT, SQL). Page rows keep their own markup
 * (`renderRow`); the data for sorting and exporting is the text those cells
 * show, so what is sorted and exported is exactly what the user reads.
 */
export function DataTable<T>({ name, title, rows, headers, actionColumns = [], renderRow, footer, className = "" }: DataTableProps<T>) {
  const context = useAppearance();
  const { t } = context;
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<{ column: number | null; direction: SortDirection }>({ column: null, direction: "asc" });
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // The text of every cell, as the user reads it: the rows are rendered to markup and their cells read back.
  const readCellTexts = (): string[][] =>
    rows.map((row, index) => {
      try {
        const markup = renderToStaticMarkup(
          <AppearanceContext.Provider value={context}>
            <table>
              <tbody>{renderRow(row, index)}</tbody>
            </table>
          </AppearanceContext.Provider>,
        );
        const cells = new DOMParser().parseFromString(markup, "text/html").querySelector("tr")?.querySelectorAll("td, th");
        return Array.from(cells ?? []).map((cell) => cleanText(cell.textContent ?? ""));
      } catch {
        return [];
      }
    });

  const dataColumns = headers.map((_, index) => index).filter((index) => !actionColumns.includes(index));

  // Only a sorted or searched table needs the cell texts while rendering; they are re-read when the data or language changes.
  const order = useMemo(() => {
    const searching = query.trim() !== "";
    if ((sort.column === null && !searching) || typeof DOMParser === "undefined") return rows.map((_, index) => index);
    const values = readCellTexts();
    const kept = new Set(matchingIndexes(values, dataColumns, query));
    return sortedIndexes(values, sort.column, sort.direction).filter((index) => kept.has(index));
    // renderRow is a new function on every render; the text it produces only changes with the data and language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, query, context.appearance.language]);

  const window = pageWindow(order.length, pageSize, page);
  const visible = order.slice(window.start, window.end);

  async function handleExport(format: ExportFormat) {
    setExporting(true);
    setExportError(null);
    try {
      const values = readCellTexts();
      // What the search leaves, in the current order.
      const kept = new Set(matchingIndexes(values, dataColumns, query));
      const ordered = sortedIndexes(values, sort.column, sort.direction).filter((index) => kept.has(index));
      await exportTable(format, {
        name,
        title: title ?? name,
        headers: dataColumns.map((index) => headers[index]),
        // Every row, in the current order - not just the page on screen.
        rows: ordered.map((rowIndex) => dataColumns.map((column) => values[rowIndex]?.[column] ?? "")),
      });
    } catch {
      setExportError(t("table.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder={t("table.searchPlaceholder")}
          aria-label={t("table.search")}
          className="w-full rounded-sm border border-line bg-surface py-1.5 pl-8 pr-8 text-sm text-ink placeholder:text-ink-soft"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPage(1);
            }}
            aria-label={t("table.clearSearch")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5" role="group" aria-label={t("table.export")}>
        <span className="mr-1 flex items-center gap-1 text-xs text-ink-soft">
          <Download className="h-3.5 w-3.5" aria-hidden /> {t("table.export")}
        </span>
        {EXPORTS.map(({ format, label }) => (
          <button
            key={format}
            type="button"
            disabled={exporting || rows.length === 0}
            onClick={() => handleExport(format)}
            className="rounded-sm border border-line px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-gold hover:text-gold disabled:cursor-not-allowed disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
      </div>
      {exportError ? <p className="text-xs text-danger">{exportError}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-gold text-left text-on-primary">
              {headers.map((header, index) => {
                const sortable = !actionColumns.includes(index);
                const active = sort.column === index;
                const Icon = !active ? ChevronsUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

                return (
                  <th
                    key={index}
                    scope="col"
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined}
                    className="px-3 py-2.5 font-semibold first:rounded-tl-sm last:rounded-tr-sm"
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSort(nextSort(sort, index));
                          setPage(1);
                        }}
                        title={active ? (sort.direction === "asc" ? t("table.sortDesc") : t("table.sortNone")) : t("table.sortAsc")}
                        className="inline-flex items-center gap-1.5 text-left font-semibold"
                      >
                        {header}
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "" : "opacity-60"}`} aria-hidden />
                      </button>
                    ) : (
                      header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="[&_td]:px-3 [&_tr:last-child]:border-b-0">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="py-6 text-center text-ink-soft">
                  {t("table.empty")}
                </td>
              </tr>
            ) : (
              visible.map((rowIndex) => <Fragment key={rowIndex}>{renderRow(rows[rowIndex], rowIndex)}</Fragment>)
            )}
          </tbody>
          {footer ? <tfoot className="[&_td]:px-3">{footer}</tfoot> : null}
        </table>
      </div>

      <div className="grid items-center gap-3 border-t border-line pt-3 text-sm text-ink sm:grid-cols-3">
        <label className="flex items-center gap-2 text-ink-soft sm:justify-self-start">
          <span>{t("table.pageSize")}</span>
          <SearchSelect
            value={String(pageSize)}
            onChange={(event) => {
              const value = event.target.value;
              setPageSize(value === "all" ? "all" : (Number(value) as PageSize));
              setPage(1);
            }}
            className="rounded-sm border border-line bg-surface px-2 py-1 text-ink"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={String(size)}>
                {size === "all" ? t("table.all") : size}
              </option>
            ))}
          </SearchSelect>
        </label>

        <div className="flex items-center justify-center gap-3 sm:justify-self-center">
          <button
            type="button"
            onClick={() => setPage(window.page - 1)}
            disabled={window.page <= 1}
            className="inline-flex items-center gap-1 rounded-sm border border-line px-2.5 py-1 transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden /> {t("table.previous")}
          </button>
          <span className="min-w-14 text-center tabular-nums" aria-label={`${t("table.page")} ${window.page} / ${window.pageCount}`}>
            {window.page}/{window.pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(window.page + 1)}
            disabled={window.page >= window.pageCount}
            className="inline-flex items-center gap-1 rounded-sm border border-line px-2.5 py-1 transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("table.next")} <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <p className="text-ink-soft sm:justify-self-end">
          {t("table.items")} <span className="font-medium text-ink tabular-nums">{shownThroughPage(order.length, window)}</span> /{" "}
          <span className="tabular-nums">{order.length}</span>
          {order.length !== rows.length ? <span className="text-xs"> ({rows.length})</span> : null}
        </p>
      </div>
    </div>
  );
}
