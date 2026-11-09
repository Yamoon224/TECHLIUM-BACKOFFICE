/**
 * Saves a table in one of the five export formats, in the browser. The heavy
 * libraries (PDF, Excel) are loaded only when their button is used.
 */

import { cleanText, toCsv, toLatin1, toSql, toTxt } from "./datatable";

export type ExportFormat = "pdf" | "xlsx" | "csv" | "txt" | "sql";

export interface ExportTable {
  /** File and SQL table name, e.g. "commandes". */
  name: string;
  /** Shown as the PDF title. */
  title: string;
  headers: string[];
  rows: string[][];
}

/** Printed under the title of every PDF export. */
const SLOGAN = "La Technologie au coeur de l'innovation";

const MIME: Record<Exclude<ExportFormat, "pdf" | "xlsx">, string> = {
  csv: "text/csv;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  sql: "application/sql;charset=utf-8",
};

/** "commandes-2026-10-28" */
export function exportFileName(name: string, format: ExportFormat, now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 10);
  const safe = name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "export";
  return `${safe}-${stamp}.${format}`;
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportTable(format: ExportFormat, table: ExportTable): Promise<void> {
  const filename = exportFileName(table.name, format);

  if (format === "csv") {
    // The BOM lets Excel read the accents of a UTF-8 CSV correctly.
    download(new Blob(["﻿", toCsv(table.headers, table.rows)], { type: MIME.csv }), filename);
    return;
  }

  if (format === "txt") {
    download(new Blob([toTxt(table.headers, table.rows)], { type: MIME.txt }), filename);
    return;
  }

  if (format === "sql") {
    download(new Blob([toSql(table.name, table.headers, table.rows)], { type: MIME.sql }), filename);
    return;
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#ee9e0b";

  if (format === "xlsx") {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const border = { borderColor: "#e5e7eb", borderStyle: "thin" as const };
    const numeric = table.headers.map((_, column) => isNumeric(table.rows.map((row) => row[column] ?? "")));
    const header = table.headers.map((value, column) => ({
      value,
      fontWeight: "bold" as const,
      textColor: "#ffffff",
      backgroundColor: accent,
      alignVertical: "center" as const,
      align: numeric[column] ? ("right" as const) : ("left" as const),
      height: 24,
      ...border,
    }));
    const body = table.rows.map((row, rowIndex) =>
      table.headers.map((_, column) => ({
        value: cleanText(row[column] ?? ""),
        align: numeric[column] ? ("right" as const) : ("left" as const),
        alignVertical: "center" as const,
        backgroundColor: rowIndex % 2 === 1 ? "#f9fafb" : "#ffffff",
        textColor: "#1f2937",
        ...border,
      })),
    );
    const blob = await writeExcelFile([header, ...body], {
      sheet: table.title.slice(0, 31).replace(/[\/?*[\]:]/g, " "),
      stickyRowsCount: 1,
      showGridLines: false,
      columns: table.headers.map((title, column) => ({
        width: Math.min(48, Math.max(10, ...[title, ...table.rows.map((row) => row[column] ?? "")].map((value) => cleanText(value).length + 3))),
      })),
    }).toBlob();
    download(blob, filename);
    return;
  }

  await exportPdf(table, filename, accent);
}

/** A column is numeric (right-aligned) when every non-empty cell reads as an amount, count or percentage. */
function isNumeric(values: string[]): boolean {
  const filled = values.map((value) => cleanText(value)).filter((value) => value !== "" && value !== "-");
  return filled.length > 0 && filled.every((value) => /^[-+]?[\d\s.,  ]+(?:\s?(?:F\s?CFA|XOF|FCFA|%|€|\$))?$/i.test(value));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16) || 0, parseInt(full.slice(2, 4), 16) || 0, parseInt(full.slice(4, 6), 16) || 0];
}

async function loadLogo(): Promise<string | null> {
  try {
    const response = await fetch("/icon-192.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function exportPdf(table: ExportTable, filename: string, accent: string): Promise<void> {
  const [{ jsPDF }, { default: autoTable }, logo] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadLogo()]);
  const pdf = new jsPDF({ orientation: table.headers.length > 5 ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const accentRgb = hexToRgb(accent);
  const numeric = table.headers.map((_, column) => isNumeric(table.rows.map((row) => row[column] ?? "")));
  const generated = new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });

  // Brand band on the first page.
  pdf.setFillColor(...accentRgb);
  pdf.rect(0, 0, width, 6, "F");
  // Centered header: logo, then title and subtitle underneath.
  const centerX = width / 2;
  let cursor = 24;
  if (logo) {
    try {
      pdf.addImage(logo, "PNG", centerX - 24, cursor, 48, 48);
      cursor += 48 + 14;
    } catch {
      /* the logo is decoration only */
    }
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(31, 41, 55);
  pdf.text(toLatin1(table.title), centerX, cursor + 14, { align: "center" });
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(10);
  pdf.setTextColor(...accentRgb);
  pdf.text(SLOGAN, centerX, cursor + 30, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(107, 114, 128);
  pdf.text(toLatin1(`TechLium  -  ${generated}  -  ${table.rows.length} ${table.rows.length > 1 ? "lignes" : "ligne"}`), centerX, cursor + 45, { align: "center" });
  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, cursor + 57, width - margin, cursor + 57);
  const tableStart = cursor + 71;

  autoTable(pdf, {
    startY: tableStart,
    head: [table.headers.map(toLatin1)],
    body: table.rows.map((row) => row.map(toLatin1)),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: { top: 6, bottom: 6, left: 7, right: 7 }, textColor: [31, 41, 55], lineColor: [229, 231, 235], lineWidth: { bottom: 0.5 }, overflow: "linebreak" },
    headStyles: { fillColor: accentRgb, textColor: 255, fontStyle: "bold", lineWidth: 0 },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: Object.fromEntries(numeric.map((isNum, column) => [column, { halign: isNum ? "right" : "left" }])),
    didParseCell: (data) => {
      if (data.section === "head" && numeric[data.column.index]) data.cell.styles.halign = "right";
    },
    margin: { left: margin, right: margin, bottom: 44 },
    showHead: "everyPage",
  });

  // Footer on every page: brand on the left, page x / y on the right.
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(229, 231, 235);
    pdf.line(margin, height - 34, width - margin, height - 34);
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text("TechLium", margin, height - 20);
    pdf.text(`Page ${page} / ${pages}`, width - margin, height - 20, { align: "right" });
  }

  pdf.save(filename);
}
