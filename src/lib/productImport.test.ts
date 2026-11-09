import { describe, expect, it } from "vitest";
import type { Category } from "./catalog";
import { IMPORT_COLUMNS, IMPORT_TEMPLATE_CSV, IMPORT_TEMPLATE_SQL, mapProducts, parseAmount, parseCsv, parseSqlInserts } from "./productImport";

const categories = [
  { id: 1, name: "Smartphones", slug: "smartphones" },
  { id: 2, name: "Sécurité et maison connectée", slug: "securite-maison-connectee" },
] as Category[];

describe("parseCsv", () => {
  it("reads quoted cells and detects the semicolon", () => {
    expect(parseCsv('a;b\n"x; y";"z ""q"""\n')).toEqual([
      ["a", "b"],
      ["x; y", 'z "q"'],
    ]);
  });

  it("skips blank lines and the BOM", () => {
    expect(parseCsv("﻿a,b\r\n\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseSqlInserts", () => {
  it("reads several rows, quotes and NULL", () => {
    const sql = "CREATE TABLE t (a TEXT);\nINSERT INTO `t` (`nom`, `prix`, `note`) VALUES ('Galaxy ''A15''', 125000, NULL), ('Yale, Linus', '131 000', 'ok');";
    expect(parseSqlInserts(sql)).toEqual({
      headers: ["nom", "prix", "note"],
      rows: [
        ["Galaxy 'A15'", "125000", ""],
        ["Yale, Linus", "131 000", "ok"],
      ],
    });
  });
});

describe("parseAmount", () => {
  it("strips spaces and currency", () => {
    expect(parseAmount("118 000 F CFA")).toBe(118000);
    expect(parseAmount("118 000")).toBe(118000);
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("mapProducts", () => {
  const headers = ["Catégorie", "Marque", "Nom", "Prix (F CFA)", "Stock", "État"];

  it("maps a valid row, finding the category by name or slug", () => {
    const rows = mapProducts({ headers, rows: [["smartphones", "Samsung", "Galaxy A15", "125 000", "20", "Reconditionné"], ["securite-maison-connectee", "Yale", "Linus", "131000", "", ""]] }, categories);
    expect(rows[0].input).toEqual({ category_id: 1, brand: "Samsung", name: "Galaxy A15", price_amount: 125000, stock_quantity: 20, condition_state: "reconditionne" });
    expect(rows[1].input).toMatchObject({ category_id: 2, stock_quantity: 0 });
  });

  it("explains why a row is refused", () => {
    const rows = mapProducts({ headers, rows: [["Inconnue", "A", "B", "1", "1", ""], ["Smartphones", "A", "B", "x", "1", ""], ["Smartphones", "", "B", "1", "1", ""]] }, categories);
    expect(rows.map((row) => row.error)).toEqual(["Catégorie inconnue : Inconnue", "Prix invalide : x", "Marque manquante"]);
  });
});

describe("templates", () => {
  const categoriesForTemplate = [
    { id: 1, name: "Smartphones", slug: "smartphones" },
    { id: 2, name: "Sécurité et maison connectée", slug: "securite-maison-connectee" },
  ] as Category[];

  it("the CSV template imports without error", () => {
    const [headers, ...rows] = parseCsv(IMPORT_TEMPLATE_CSV);
    expect(headers).toEqual(IMPORT_COLUMNS.map((column) => column.name));
    expect(mapProducts({ headers, rows }, categoriesForTemplate).map((row) => row.error)).toEqual([null, null]);
  });

  it("the SQL template imports without error", () => {
    const table = parseSqlInserts(IMPORT_TEMPLATE_SQL);
    expect(table.headers).toEqual(IMPORT_COLUMNS.map((column) => column.name));
    expect(table.rows).toHaveLength(2);
    expect(mapProducts(table, categoriesForTemplate).map((row) => row.error)).toEqual([null, null]);
  });
});
