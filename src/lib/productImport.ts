/**
 * Bulk product import: reads a CSV, SQL (INSERT statements) or Excel file into
 * a table of text cells, then maps each row to a `ProductInput`. Parsing and
 * mapping are pure; the creation itself goes through the regular product API,
 * one product per row, so every row gets the server's own validation.
 */

import type { Category, ConditionState, ProductInput } from "./catalog";

export type ImportTable = { headers: string[]; rows: string[][] };

export const IMPORT_EXTENSIONS = [".xlsx", ".csv", ".sql"] as const;

/** Header text without accents, case or punctuation: "Prix (F CFA)" -> "prixfcfa". */
function key(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** CSV text to rows; the delimiter (comma, semicolon or tab) is detected from the first line. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].map((candidate) => ({ candidate, count: firstLine.split(candidate).length })).sort((a, b) => b.count - a.count)[0].candidate;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

/** Reads one SQL value (string, number, NULL) at `index`; returns it and the index after it. */
function readSqlValue(sql: string, index: number): [string, number] {
  let i = index;
  while (/\s/.test(sql[i] ?? "")) i += 1;

  if (sql[i] === "'") {
    let value = "";
    i += 1;
    while (i < sql.length) {
      if (sql[i] === "'" && sql[i + 1] === "'") {
        value += "'";
        i += 2;
      } else if (sql[i] === "\\" && i + 1 < sql.length) {
        const next = sql[i + 1];
        value += next === "n" ? "\n" : next === "t" ? "\t" : next === "r" ? "\r" : next;
        i += 2;
      } else if (sql[i] === "'") {
        return [value, i + 1];
      } else {
        value += sql[i];
        i += 1;
      }
    }
    return [value, i];
  }

  let end = i;
  while (end < sql.length && sql[end] !== "," && sql[end] !== ")") end += 1;
  const raw = sql.slice(i, end).trim();
  return [raw.toUpperCase() === "NULL" ? "" : raw, end];
}

/** The rows of every `INSERT INTO t (a, b) VALUES (...), (...);` of a SQL script; the first statement's columns are the headers. */
export function parseSqlInserts(sql: string): ImportTable {
  const statement = /INSERT\s+(?:IGNORE\s+)?INTO\s+[`"\[]?[\w.]+[`"\]]?\s*\(([^)]*)\)\s*VALUES\s*/gi;
  let headers: string[] | null = null;
  const rows: string[][] = [];

  for (let match = statement.exec(sql); match !== null; match = statement.exec(sql)) {
    const columns = match[1].split(",").map((column) => column.trim().replace(/^[`"\[]|[`"\]]$/g, ""));
    headers ??= columns;
    let position = statement.lastIndex;

    while (sql[position] !== undefined) {
      while (/\s|,/.test(sql[position] ?? "")) position += 1;
      if (sql[position] !== "(") break;
      position += 1;

      const row: string[] = [];
      for (;;) {
        const [value, next] = readSqlValue(sql, position);
        row.push(value);
        position = next;
        while (/\s/.test(sql[position] ?? "")) position += 1;
        if (sql[position] === ",") {
          position += 1;
          continue;
        }
        position += 1; // the closing parenthesis
        break;
      }
      rows.push(row);
    }
    statement.lastIndex = position;
  }

  return { headers: headers ?? [], rows };
}

/** Any supported file to a table; the first row of a CSV or Excel sheet holds the column names. */
export async function readImportFile(file: File): Promise<ImportTable> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".sql")) return parseSqlInserts(await file.text());

  if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file);
    const cells = sheet.map((row) => row.map((value) => (value === null || value === undefined ? "" : String(value))));
    const [headers = [], ...rows] = cells.filter((row) => row.some((value) => value.trim() !== ""));
    return { headers, rows };
  }

  if (name.endsWith(".csv")) {
    const [headers = [], ...rows] = parseCsv(await file.text());
    return { headers, rows };
  }

  throw new Error("unsupported-format");
}

const COLUMN_ALIASES: Record<string, string[]> = {
  category: ["categorie", "category", "categoryid", "categorieid", "categoryname", "categoryslug"],
  brand: ["marque", "brand"],
  name: ["nom", "name", "produit", "product", "designation", "libelle"],
  description: ["description", "desc"],
  condition: ["etat", "condition", "conditionstate", "state"],
  sku: ["sku", "reference", "ref", "code"],
  price: ["prix", "price", "priceamount", "prixfcfa", "prixunitaire", "montant"],
  currency: ["devise", "currency"],
  stock: ["stock", "quantite", "quantity", "stockquantity", "qte", "qty"],
  warranty: ["garantie", "garantiemois", "warranty", "warrantymonths"],
  slug: ["slug"],
};

const CONDITIONS: Record<string, ConditionState> = {
  neuf: "neuf",
  new: "neuf",
  reconditionne: "reconditionne",
  refurbished: "reconditionne",
  occasion: "occasion",
  used: "occasion",
  secondhand: "occasion",
};

export interface ImportRow {
  /** 1-based line in the file, header excluded. */
  line: number;
  input: ProductInput | null;
  /** Why the row cannot be imported; null when it can. */
  error: string | null;
  /** For the preview: what the file says. */
  label: string;
}

/** "118 000 F CFA" -> 118000; null when it is not a whole non-negative number. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s  ]/g, "").replace(/(fcfa|cfa|xof|xaf|f)$/i, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isInteger(value) ? value : Math.round(value);
}

function findCategory(value: string, categories: readonly Category[]): Category | undefined {
  const wanted = key(value);
  if (wanted === "") return undefined;
  return categories.find((category) => String(category.id) === value.trim() || key(category.name) === wanted || key(category.slug) === wanted);
}

/** Maps every row of the table to a product input, or to the reason it cannot be one. */
export function mapProducts(table: ImportTable, categories: readonly Category[]): ImportRow[] {
  const columns = table.headers.map(key);
  const indexOf = (field: string) => columns.findIndex((column) => COLUMN_ALIASES[field].includes(column));
  const at = {
    category: indexOf("category"),
    brand: indexOf("brand"),
    name: indexOf("name"),
    description: indexOf("description"),
    condition: indexOf("condition"),
    sku: indexOf("sku"),
    price: indexOf("price"),
    currency: indexOf("currency"),
    stock: indexOf("stock"),
    warranty: indexOf("warranty"),
    slug: indexOf("slug"),
  };

  return table.rows.map((cells, position) => {
    const read = (field: keyof typeof at) => (at[field] >= 0 ? (cells[at[field]] ?? "").trim() : "");
    const line = position + 1;
    const name = read("name");
    const brand = read("brand");
    const label = [brand, name].filter(Boolean).join(" ") || `#${line}`;
    const fail = (error: string): ImportRow => ({ line, input: null, error, label });

    if (name === "") return fail("Nom manquant");
    if (brand === "") return fail("Marque manquante");

    const category = findCategory(read("category"), categories);
    if (!category) return fail(read("category") === "" ? "Catégorie manquante" : `Catégorie inconnue : ${read("category")}`);

    const price = parseAmount(read("price"));
    if (price === null) return fail(read("price") === "" ? "Prix manquant" : `Prix invalide : ${read("price")}`);

    const stockText = read("stock");
    const stock = stockText === "" ? 0 : parseAmount(stockText);
    if (stock === null) return fail(`Stock invalide : ${stockText}`);

    const conditionText = read("condition");
    const condition = conditionText === "" ? undefined : CONDITIONS[key(conditionText)];
    if (conditionText !== "" && !condition) return fail(`État inconnu : ${conditionText} (neuf, reconditionné ou occasion)`);

    const warrantyText = read("warranty");
    const warranty = warrantyText === "" ? undefined : parseAmount(warrantyText);
    if (warranty === null) return fail(`Garantie invalide : ${warrantyText}`);

    const input: ProductInput = { category_id: category.id, brand, name, price_amount: price, stock_quantity: stock };
    if (read("description")) input.description = read("description");
    if (condition) input.condition_state = condition;
    if (read("sku")) input.sku = read("sku");
    if (read("slug")) input.slug = read("slug");
    if (read("currency")) input.currency = read("currency").toUpperCase().slice(0, 3);
    if (warranty !== undefined) input.warranty_months = warranty;

    return { line, input, error: null, label };
  });
}

/** The columns of an import file, in the order of the templates. */
export const IMPORT_COLUMNS: { name: string; required: boolean; numeric: boolean; help: string; example: string[] }[] = [
  { name: "categorie", required: true, numeric: false, help: "Nom, slug ou identifiant d'une catégorie existante", example: ["Smartphones", "Sécurité et maison connectée"] },
  { name: "marque", required: true, numeric: false, help: "Marque du produit", example: ["Samsung", "Yale"] },
  { name: "nom", required: true, numeric: false, help: "Nom du produit", example: ["Galaxy A15", "Serrure connectée Linus"] },
  { name: "description", required: false, numeric: false, help: "Texte de présentation (5000 caractères au plus)", example: ["Écran 6,5 pouces, 128 Go", "Serrure à code et application mobile"] },
  { name: "etat", required: false, numeric: false, help: "neuf, reconditionné ou occasion (neuf par défaut)", example: ["neuf", "reconditionné"] },
  { name: "sku", required: false, numeric: false, help: "Référence unique du produit", example: ["SAM-A15-128", "YALE-LINUS"] },
  { name: "prix", required: true, numeric: true, help: "Prix en F CFA, nombre entier", example: ["125000", "131000"] },
  { name: "stock", required: false, numeric: true, help: "Quantité en stock, nombre entier (0 par défaut)", example: ["20", "5"] },
  { name: "garantie", required: false, numeric: true, help: "Garantie en mois, nombre entier", example: ["12", "24"] },
];

/** The example products of the templates, one array of cells per product. */
export const IMPORT_EXAMPLE_ROWS: string[][] = IMPORT_COLUMNS[0].example.map((_, row) => IMPORT_COLUMNS.map((column) => column.example[row]));

const NEWLINE = String.fromCharCode(10);

function csvCell(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The CSV a user can fill in: the columns the import understands, with example rows. */
export const IMPORT_TEMPLATE_CSV = [IMPORT_COLUMNS.map((column) => column.name), ...IMPORT_EXAMPLE_ROWS].map((row) => row.map(csvCell).join(",")).join(NEWLINE);

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * The SQL a user can fill in: a CREATE TABLE documenting the columns, then one
 * statement inserting the products. Only the insert statements are read on import.
 */
export const IMPORT_TEMPLATE_SQL = [
  "-- Modèle d'import de produits TechLium.",
  "-- Seules les instructions d'insertion sont lues ; le nom de la table n'a pas d'importance.",
  "-- Colonnes obligatoires : categorie, marque, nom, prix.",
  "",
  "CREATE TABLE IF NOT EXISTS `produits` (",
  IMPORT_COLUMNS.map((column) => `  \`${column.name}\` ${column.numeric ? "INTEGER" : "TEXT"} ${column.required ? "NOT NULL" : "NULL"}`).join("," + NEWLINE),
  ");",
  "",
  `INSERT INTO \`produits\` (${IMPORT_COLUMNS.map((column) => `\`${column.name}\``).join(", ")}) VALUES`,
  IMPORT_EXAMPLE_ROWS.map((row) => `  (${row.map((value, index) => (IMPORT_COLUMNS[index].numeric ? value : sqlText(value))).join(", ")})`).join("," + NEWLINE) + ";",
].join(NEWLINE);
