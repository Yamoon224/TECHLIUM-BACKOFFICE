import { describe, expect, it } from "vitest";
import { firstError, parseCoordinate, ShopError } from "./shop";

describe("parseCoordinate", () => {
  it("reads a decimal with a point or a comma", () => {
    expect(parseCoordinate("5.3013244")).toBe(5.3013244);
    expect(parseCoordinate(" -4,0021515 ")).toBe(-4.0021515);
  });

  it("reads an empty field as no coordinate", () => {
    expect(parseCoordinate("  ")).toBeNull();
  });

  it("flags text that is not a number", () => {
    expect(parseCoordinate("5°18'")).toBeNaN();
    expect(parseCoordinate("abc")).toBeNaN();
  });
});

describe("firstError", () => {
  it("returns the first message of a field, or null", () => {
    const error = new ShopError("Invalid", { longitude: ["Required.", "Other."] });
    expect(firstError(error, "longitude")).toBe("Required.");
    expect(firstError(error, "latitude")).toBeNull();
    expect(firstError(null, "latitude")).toBeNull();
  });
});
