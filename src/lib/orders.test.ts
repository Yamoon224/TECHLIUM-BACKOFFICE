import { describe, expect, it } from "vitest";
import { hasSplit, historyLine, sellerLabel } from "./orders";

describe("sub-order helpers", () => {
<<<<<<< HEAD
  it("labels TechLium's own stock and vendors", () => {
    expect(sellerLabel({ vendor_id: null })).toBe("TechLium");
=======
  it("labels TechniLium's own stock and vendors", () => {
    expect(sellerLabel({ vendor_id: null })).toBe("TechniLium");
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
    expect(sellerLabel({ vendor_id: 12 })).toBe("Vendeur #12");
  });

  it("only shows a breakdown when several sellers are involved", () => {
    const share = { id: 1, vendor_id: null, status: "pending" as const, subtotal: { amount: 1, currency: "XOF" }, delivered_at: null };
    expect(hasSplit({ sub_orders: [share] })).toBe(false);
    expect(hasSplit({ sub_orders: [share, { ...share, id: 2 }] })).toBe(true);
    expect(hasSplit({})).toBe(false);
  });
});

describe("historyLine", () => {
  it("lists each step with its date", () => {
    expect(
      historyLine([
        { status: "pending", at: "2026-10-27T10:00:00Z" },
        { status: "confirmed", at: "2026-10-28T08:00:00Z" },
      ]),
    ).toBe("Reçue 27/10 · Confirmée 28/10");
  });

  it("is empty without history", () => {
    expect(historyLine(undefined)).toBe("");
    expect(historyLine([])).toBe("");
  });
});
