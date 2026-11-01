import { describe, expect, it } from "vitest";
import { translate } from "./i18n";
import { isActive, STAFF_NAV } from "./navigation";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("names the page and the app", () => {
    expect(pageTitle("Commandes")).toBe("Commandes - TechniLium Backoffice");
    expect(pageTitle(null)).toBe("TechniLium Backoffice");
  });

  it("is translated with the navigation labels, in both languages", () => {
    const orders = STAFF_NAV.flatMap((group) => group.items).find((item) => isActive(item.href, "/commandes"));

    expect(pageTitle(translate("fr", orders!.label))).toBe("Commandes - TechniLium Backoffice");
    expect(pageTitle(translate("en", orders!.label))).toBe("Orders - TechniLium Backoffice");
  });
});
