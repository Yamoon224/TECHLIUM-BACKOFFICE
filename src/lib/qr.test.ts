import { describe, expect, it } from "vitest";
import { buildQrSvg, clampLogoRatio, DEFAULT_STYLE, isLogoFileAllowed, logoBox, logoBoxExact, LOGO_RATIO, parseQrPayload, qrFileName } from "./qr";

describe("logoBox", () => {
  it("centres a square logo of the asked share of the code", () => {
    expect(logoBox(500, 0.2)).toEqual({ x: 200, y: 200, side: 100 });
  });

  it("never lets the logo grow past what error correction can hide", () => {
    expect(logoBox(500, 0.9).side).toBe(Math.round(500 * LOGO_RATIO.max));
    expect(logoBox(500, 0).side).toBe(Math.round(500 * LOGO_RATIO.min));
  });

  it("falls back to the default share for a nonsense value", () => {
    expect(clampLogoRatio(Number.NaN)).toBe(LOGO_RATIO.default);
  });
});

describe("parseQrPayload", () => {
  it("reads back what a code says", () => {
    expect(parseQrPayload("TechLium:ORDER:TCH-20261025-AB12CD")).toEqual({ kind: "order", reference: "TCH-20261025-AB12CD" });
    expect(parseQrPayload(" TechLium:SUPPLY:12 ")).toEqual({ kind: "supply", reference: "12" });
  });

  it("refuses anything else", () => {
    expect(parseQrPayload("https://exemple.com")).toBeNull();
    expect(parseQrPayload("TechLium:USER:1")).toBeNull();
    expect(parseQrPayload("TechLium:ORDER:<script>")).toBeNull();
  });
});

describe("qrFileName", () => {
  it("keeps a file name safe", () => {
    expect(qrFileName("invoice", "F-2026/0042", "png")).toBe("qr-invoice-F-2026-0042.png");
    expect(qrFileName("order", "../../x", "svg")).toBe("qr-order-x.svg");
    expect(qrFileName("order", "???", "svg")).toBe("qr-order-code.svg");
  });
});

describe("isLogoFileAllowed", () => {
  it("accepts raster pictures of a sensible size, never SVG", () => {
    expect(isLogoFileAllowed({ type: "image/png", size: 1000 })).toBe(true);
    expect(isLogoFileAllowed({ type: "image/svg+xml", size: 1000 })).toBe(false);
    expect(isLogoFileAllowed({ type: "image/png", size: 3 * 1024 * 1024 })).toBe(false);
    expect(isLogoFileAllowed({ type: "image/png", size: 0 })).toBe(false);
  });
});

describe("logoBoxExact", () => {
  it("centres the logo in any unit, fractions included", () => {
    expect(logoBoxExact(25, 0.2)).toEqual({ x: 10, y: 10, side: 5 });
    expect(logoBoxExact(33, 0.2).side).toBeCloseTo(6.6);
  });
});

describe("buildQrSvg", () => {
  it("is a square and places the logo inside the code, in the drawing's own units", async () => {
    const svg = await buildQrSvg("TechLium:ORDER:1", { ...DEFAULT_STYLE, logo: "data:image/png;base64,AAAA" });
    const [, units] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg) ?? [];
    const sides = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);

    expect(sides?.[1]).toBe(sides?.[2]);
    const image = /<image [^>]*x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg);
    expect(Number(image?.[1]) + Number(image?.[3]) / 2).toBeCloseTo(Number(units) / 2);
    expect(Number(image?.[1]) + Number(image?.[3])).toBeLessThan(Number(units));
  });
});
