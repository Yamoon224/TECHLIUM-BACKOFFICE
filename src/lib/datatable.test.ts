import { describe, expect, it } from "vitest";
import {
  compareCells,
  matchingIndexes,
  nextSort,
  pageWindow,
  parseDate,
  parseNumber,
  shownThroughPage,
  sortedIndexes,
  sqlIdentifier,
  toCsv,
  toLatin1,
  toSql,
  toTxt,
  uniqueIdentifiers,
} from "./datatable";

describe("parseNumber", () => {
  it("reads amounts, percentages and signed numbers", () => {
    expect(parseNumber("118 000 F CFA")).toBe(118000);
    expect(parseNumber("118 000 F CFA")).toBe(118000);
    expect(parseNumber("12,5 %")).toBe(12.5);
    expect(parseNumber("−5")).toBe(-5);
    expect(parseNumber("42")).toBe(42);
  });

  it("is null for text, ids and empty cells", () => {
    expect(parseNumber("FAC-2026-000001")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("12 abc")).toBeNull();
  });
});

describe("parseDate", () => {
  it("reads day/month/year with an optional time", () => {
    expect(parseDate("27/10/2026")).toBe(Date.UTC(2026, 9, 27));
    expect(parseDate("27/10/2026 14:30")).toBe(Date.UTC(2026, 9, 27, 14, 30));
    expect(parseDate("2026-10-27")).toBeNull();
  });
});

describe("compareCells", () => {
  it("compares numbers as numbers, not text", () => {
    expect(compareCells("9", "10")).toBeLessThan(0);
    expect(compareCells("1 000 F CFA", "999 F CFA")).toBeGreaterThan(0);
  });

  it("compares dates chronologically", () => {
    expect(compareCells("02/01/2026", "01/02/2026")).toBeLessThan(0);
  });

  it("compares text naturally and ignoring accents and case", () => {
    expect(compareCells("Commande 2", "commande 10")).toBeLessThan(0);
    expect(compareCells("Élodie", "Eloise")).toBeLessThan(0);
  });

  it("puts empty cells last", () => {
    expect(compareCells("", "a")).toBeGreaterThan(0);
    expect(compareCells("a", "")).toBeLessThan(0);
    expect(compareCells("", "")).toBe(0);
  });
});

describe("sortedIndexes", () => {
  const values = [["b", "10"], ["a", "9"], ["c", ""], ["a", "100"]];

  it("keeps the original order without a sort", () => {
    expect(sortedIndexes(values, null, "asc")).toEqual([0, 1, 2, 3]);
  });

  it("sorts ascending and descending, stably, with empties always last", () => {
    expect(sortedIndexes(values, 0, "asc")).toEqual([1, 3, 0, 2]);
    expect(sortedIndexes(values, 1, "asc")).toEqual([1, 0, 3, 2]);
    expect(sortedIndexes(values, 1, "desc")).toEqual([3, 0, 1, 2]);
  });
});

describe("nextSort", () => {
  it("cycles ascending, descending, none on one column and restarts on another", () => {
    let state = nextSort({ column: null, direction: "asc" }, 2);
    expect(state).toEqual({ column: 2, direction: "asc" });
    state = nextSort(state, 2);
    expect(state).toEqual({ column: 2, direction: "desc" });
    state = nextSort(state, 2);
    expect(state.column).toBeNull();
    expect(nextSort({ column: 2, direction: "desc" }, 0)).toEqual({ column: 0, direction: "asc" });
  });
});

describe("pageWindow", () => {
  it("slices into pages and clamps the page number", () => {
    expect(pageWindow(57, 10, 1)).toEqual({ page: 1, pageCount: 6, start: 0, end: 10 });
    expect(pageWindow(57, 10, 6)).toEqual({ page: 6, pageCount: 6, start: 50, end: 57 });
    expect(pageWindow(57, 10, 99).page).toBe(6);
    expect(pageWindow(57, 10, 0).page).toBe(1);
  });

  it("is a single page for All or an empty table", () => {
    expect(pageWindow(57, "all", 3)).toEqual({ page: 1, pageCount: 1, start: 0, end: 57 });
    expect(pageWindow(0, 10, 1)).toEqual({ page: 1, pageCount: 1, start: 0, end: 0 });
  });

  it("counts the items shown from the first page through the current one", () => {
    expect(shownThroughPage(57, pageWindow(57, 10, 1))).toBe(10);
    expect(shownThroughPage(57, pageWindow(57, 10, 3))).toBe(30);
    expect(shownThroughPage(57, pageWindow(57, 10, 6))).toBe(57);
    expect(shownThroughPage(57, pageWindow(57, "all", 1))).toBe(57);
  });
});

describe("exports", () => {
  const headers = ["Nom", "Montant"];
  const rows = [["Awa, Diallo", "1 000"], ['Dit "Moussa"', ""]];

  it("writes CSV with quoting", () => {
    expect(toCsv(headers, rows)).toBe('Nom,Montant\r\n"Awa, Diallo",1 000\r\n"Dit ""Moussa""",');
  });

  it("writes tab-separated text without stray tabs or newlines", () => {
    expect(toTxt(headers, [["a\tb\nc", "1"]])).toBe("Nom\tMontant\na b c\t1");
  });

  it("builds safe SQL identifiers", () => {
    expect(sqlIdentifier("N° de facture")).toBe("n_de_facture");
    expect(sqlIdentifier("Écriture (débit)")).toBe("ecriture_debit");
    expect(sqlIdentifier("123")).toBe("c_123");
    expect(sqlIdentifier("")).toBe("c_col");
    expect(sqlIdentifier("a`; DROP TABLE x;--")).toBe("a_drop_table_x");
  });

  it("makes duplicate column names unique", () => {
    expect(uniqueIdentifiers(["Total", "Total", "Nom"])).toEqual(["total", "total_2", "nom"]);
  });

  it("writes CREATE TABLE and escaped INSERTs, numbers bare, empties NULL", () => {
    const sql = toSql("Mes commandes", ["Numéro", "Total", "Note"], [["TCH-1", "118 000 F CFA", "l'écran"], ["0700", "", "a\\b"]]);

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS `mes_commandes`");
    expect(sql).toContain("`numero` TEXT NULL");
    expect(sql).toContain("VALUES ('TCH-1', 118000, 'l''écran');");
    expect(sql).toContain("VALUES ('0700', NULL, 'a\\\\b');");
  });

  it("keeps a leading-zero value as text", () => {
    expect(toSql("t", ["a"], [["007"]])).toContain("VALUES ('007');");
  });

  it("replaces what the PDF fonts cannot draw", () => {
    expect(toLatin1("Café – 5 € ✓")).toBe("Café ? 5 ? ?");
  });
});

describe("matchingIndexes", () => {
  it("finds an amount typed without its thousands separators", () => {
    const amounts = [["CMD-1", "118 000 F CFA"], ["CMD-2", "5 500 F CFA"]];
    expect(matchingIndexes(amounts, [0, 1], "118000")).toEqual([0]);
    expect(matchingIndexes(amounts, [0, 1], "118 000")).toEqual([0]);
    expect(matchingIndexes(amounts, [0, 1], "5500")).toEqual([1]);
  });

  const values = [
    ["CMD-1", "Électro Kouassi", "12 000 F CFA"],
    ["CMD-2", "Awa Traoré", "9 500 F CFA"],
    ["CMD-3", "Awa Électro", "500 F CFA"],
  ];

  it("keeps every row for an empty query", () => {
    expect(matchingIndexes(values, [0, 1, 2], "  ")).toEqual([0, 1, 2]);
  });

  it("ignores case and accents, and needs every word, in any order", () => {
    expect(matchingIndexes(values, [0, 1, 2], "electro")).toEqual([0, 2]);
    expect(matchingIndexes(values, [0, 1, 2], "ELECTRO awa")).toEqual([2]);
  });

  it("only looks in the given columns", () => {
    expect(matchingIndexes(values, [0, 2], "awa")).toEqual([]);
    expect(matchingIndexes(values, [0, 2], "cmd-2")).toEqual([1]);
  });
});
