/** Downloads of the import templates (Excel, CSV, SQL), in the browser. */

import { IMPORT_COLUMNS, IMPORT_EXAMPLE_ROWS, IMPORT_TEMPLATE_CSV, IMPORT_TEMPLATE_SQL } from "./productImport";

export type TemplateFormat = "xlsx" | "csv" | "sql";

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadImportTemplate(format: TemplateFormat): Promise<void> {
  if (format === "csv") {
    // The BOM lets Excel read the accents of a UTF-8 CSV.
    save(new Blob(["﻿", IMPORT_TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }), "modele-import-produits.csv");
    return;
  }

  if (format === "sql") {
    save(new Blob([IMPORT_TEMPLATE_SQL], { type: "application/sql;charset=utf-8" }), "modele-import-produits.sql");
    return;
  }

  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#ee9e0b";
  const border = { borderColor: "#e5e7eb", borderStyle: "thin" as const };

  // Required columns get the accent colour, the optional ones a dark grey.
  const header = IMPORT_COLUMNS.map((column) => ({
    value: column.name,
    fontWeight: "bold" as const,
    textColor: "#ffffff",
    backgroundColor: column.required ? accent : "#6b7280",
    alignVertical: "center" as const,
    height: 24,
    ...border,
  }));
  const body = IMPORT_EXAMPLE_ROWS.map((row) =>
    row.map((value, index) => ({
      // Numbers stay numbers, so the sheet shows them as such.
      value: IMPORT_COLUMNS[index].numeric ? Number(value) : value,
      align: IMPORT_COLUMNS[index].numeric ? ("right" as const) : ("left" as const),
      textColor: "#1f2937",
      ...border,
    })),
  );

  const blob = await writeExcelFile([header, ...body], {
    sheet: "Produits",
    stickyRowsCount: 1,
    columns: IMPORT_COLUMNS.map((column) => ({ width: Math.max(14, column.name === "description" ? 40 : column.name === "nom" || column.name === "categorie" ? 28 : 16) })),
  }).toBlob();
  save(blob, "modele-import-produits.xlsx");
}
