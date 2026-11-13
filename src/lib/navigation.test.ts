import { describe, expect, it } from "vitest";
import { canSeeNotifications, isActive, isPageForbidden, navFor, shortcutsFor, STAFF_NAV } from "./navigation";

describe("navFor", () => {
  it("gives a vendor-only account just its own space", () => {
    const groups = navFor(["vendeur_tiers"]);

    expect(groups.flatMap((group) => group.items.map((item) => item.href))).toEqual(["/espace-vendeur"]);
    expect(shortcutsFor(["vendeur_tiers"]).map((item) => item.href)).toEqual(["/espace-vendeur"]);
  });

  it("gives staff the whole menu, with no page listed twice", () => {
    const hrefs = navFor(["comptable"]).flatMap((group) => group.items.map((item) => item.href));

    expect(hrefs).toContain("/comptabilite");
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps every former menu page", () => {
    const hrefs = STAFF_NAV.flatMap((group) => group.items.map((item) => item.href));
    const former = [
      "/", "/commandes", "/categories", "/bannieres", "/boutique", "/produits", "/offres", "/vendeurs", "/stock", "/achats", "/ventes-internes", "/paiements", "/livraisons",
      "/factures", "/comptabilite", "/reversements", "/retours", "/rapports", "/promotions", "/annonces", "/support", "/avis", "/notifications", "/audit",
      "/qrcodes", "/acces",
    ];

    expect(hrefs.sort()).toEqual([...former].sort());
  });
});

describe("isActive", () => {
  it("matches the page and its sub-pages, the root only exactly", () => {
    expect(isActive("/commandes", "/commandes")).toBe(true);
    expect(isActive("/commandes", "/commandes/12")).toBe(true);
    expect(isActive("/commandes", "/commandesx")).toBe(false);
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/", "/stock")).toBe(false);
  });
});

describe("navFor with the features of an account", () => {
  const hrefs = (roles: string[], abilities?: string[]) => navFor(roles, abilities).flatMap((group) => group.items.map((item) => item.href));

  it("hides what the account may not use, and the sections left empty", () => {
    const shown = hrefs(["comptable"], ["manage-payments", "manage-invoices"]);

    expect(shown).toEqual(expect.arrayContaining(["/", "/paiements", "/factures"]));
    expect(shown).not.toContain("/commandes");
    expect(shown).not.toContain("/audit");
    expect(navFor(["comptable"], ["manage-payments"]).map((group) => group.label)).not.toContain("nav.insight");
  });

  it("hides a feature switched off even for a role that normally has it", () => {
    expect(hrefs(["administrateur"], ["manage-orders"])).not.toContain("/audit");
  });

  it("shows access management to the super admin only", () => {
    expect(hrefs(["super_admin"], [])).toContain("/acces");
    expect(hrefs(["administrateur"], ["generate-qrcodes"])).not.toContain("/acces");
    expect(hrefs(["administrateur"], ["generate-qrcodes"])).toContain("/qrcodes");
  });

  it("hides nothing while the features are not known yet", () => {
    expect(hrefs(["comptable"])).toContain("/commandes");
  });

  it("filters the top-bar shortcuts the same way", () => {
    expect(shortcutsFor(["comptable"], ["manage-invoices"]).map((item) => item.href)).toEqual(["/", "/factures"]);
  });
});

describe("isPageForbidden", () => {
  it("keeps an account away from a page of a feature it does not have", () => {
    expect(isPageForbidden("/commandes", { roles: ["comptable"], abilities: ["manage-invoices"] })).toBe(true);
    expect(isPageForbidden("/commandes/12", { roles: ["comptable"], abilities: ["manage-invoices"] })).toBe(true);
    expect(isPageForbidden("/factures", { roles: ["comptable"], abilities: ["manage-invoices"] })).toBe(false);
  });

  it("leaves the home page, unknown pages and vendor accounts alone", () => {
    expect(isPageForbidden("/", { roles: ["comptable"], abilities: [] })).toBe(false);
    expect(isPageForbidden("/mot-de-passe-oublie", { roles: ["comptable"], abilities: [] })).toBe(false);
    expect(isPageForbidden("/espace-vendeur", { roles: ["vendeur_tiers"], abilities: [] })).toBe(false);
  });

  it("reserves /acces for the super admin", () => {
    expect(isPageForbidden("/acces", { roles: ["administrateur"], abilities: [] })).toBe(true);
    expect(isPageForbidden("/acces", { roles: ["super_admin"], abilities: [] })).toBe(false);
  });
});

describe("canSeeNotifications", () => {
  it("shows the bell to staff, unless the Notifications feature is switched off", () => {
    expect(canSeeNotifications(["support"], undefined)).toBe(true);
    expect(canSeeNotifications(["support"], ["manage-notifications"])).toBe(true);
    expect(canSeeNotifications(["support"], ["manage-orders"])).toBe(false);
  });

  it("never shows it to a vendor-only account", () => {
    expect(canSeeNotifications(["vendeur_tiers"], ["manage-notifications"])).toBe(false);
  });
});
