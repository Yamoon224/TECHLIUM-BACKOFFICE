import { describe, expect, it } from "vitest";
import { translate } from "./i18n";
import { isActive, STAFF_NAV } from "./navigation";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("names the page and the app", () => {
<<<<<<< HEAD
    expect(pageTitle("Commandes")).toBe("Commandes - TechLium Backoffice");
    expect(pageTitle(null)).toBe("TechLium Backoffice");
=======
    expect(pageTitle("Commandes")).toBe("Commandes - TechniLium Backoffice");
    expect(pageTitle(null)).toBe("TechniLium Backoffice");
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
  });

  it("is translated with the navigation labels, in both languages", () => {
    const orders = STAFF_NAV.flatMap((group) => group.items).find((item) => isActive(item.href, "/commandes"));

<<<<<<< HEAD
    expect(pageTitle(translate("fr", orders!.label))).toBe("Commandes - TechLium Backoffice");
    expect(pageTitle(translate("en", orders!.label))).toBe("Orders - TechLium Backoffice");
=======
    expect(pageTitle(translate("fr", orders!.label))).toBe("Commandes - TechniLium Backoffice");
    expect(pageTitle(translate("en", orders!.label))).toBe("Orders - TechniLium Backoffice");
>>>>>>> 0376d01425630b79cfcc80c036cb7a4206e89841
  });
});
