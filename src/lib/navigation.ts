import {
  BadgeEuro,
  BarChart3,
  Boxes,
  Megaphone,
  GalleryHorizontal,
  Calculator,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tag,
  Tags,
  Truck,
  Undo2,
  Wallet,
  Bell,
  ShoppingBasket,
  KeyRound,
  QrCode,
  LifeBuoy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { MessageKey } from "./i18n";
import { isVendorOnly } from "./roles";

export interface NavItem {
  href: string;
  label: MessageKey;
  Icon: LucideIcon;
  /** The feature this page belongs to: without it (or with it switched off) the entry is not shown. */
  ability?: string;
  /** Only the super admin sees it. */
  superAdminOnly?: boolean;
}

export interface NavGroup {
  label: MessageKey;
  items: NavItem[];
}

/**
 * The staff menu. Like before, this only shapes the interface: the API
 * enforces who may do what.
 */
export const STAFF_NAV: NavGroup[] = [
  { label: "nav.general", items: [{ href: "/", label: "nav.dashboard", Icon: LayoutDashboard }] },
  {
    label: "nav.sales",
    items: [
      { href: "/commandes", label: "nav.orders", Icon: ShoppingCart, ability: "manage-orders" },
      { href: "/ventes-internes", label: "nav.internalSales", Icon: ShoppingBasket, ability: "manage-internal-sales" },
      { href: "/paiements", label: "nav.payments", Icon: Wallet, ability: "manage-payments" },
      { href: "/livraisons", label: "nav.shipping", Icon: Truck, ability: "manage-shipments" },
      { href: "/factures", label: "nav.invoices", Icon: FileText, ability: "manage-invoices" },
      { href: "/retours", label: "nav.returns", Icon: Undo2, ability: "manage-returns" },
      { href: "/promotions", label: "nav.promotions", Icon: Tag, ability: "manage-promotions" },
      { href: "/annonces", label: "nav.announcements", Icon: Megaphone, ability: "manage-promotions" },
    ],
  },
  {
    label: "nav.catalog",
    items: [
      { href: "/categories", label: "nav.categories", Icon: Tags, ability: "manage-catalog" },
      { href: "/bannieres", label: "nav.banners", Icon: GalleryHorizontal, ability: "manage-catalog" },
      { href: "/produits", label: "nav.products", Icon: Package, ability: "manage-catalog" },
      { href: "/offres", label: "nav.moderation", Icon: PackageCheck, ability: "manage-catalog" },
      { href: "/stock", label: "nav.stock", Icon: Boxes, ability: "manage-stock" },
      { href: "/vendeurs", label: "nav.vendors", Icon: Store, ability: "manage-vendors" },
    ],
  },
  {
    label: "nav.finance",
    items: [
      { href: "/achats", label: "nav.purchases", Icon: ShoppingBag, ability: "manage-procurement" },
      { href: "/comptabilite", label: "nav.accounting", Icon: Calculator, ability: "manage-accounting" },
      { href: "/reversements", label: "nav.payouts", Icon: BadgeEuro, ability: "manage-payouts" },
    ],
  },
  {
    label: "nav.customers",
    items: [
      { href: "/support", label: "nav.support", Icon: LifeBuoy, ability: "manage-support" },
      { href: "/avis", label: "nav.reviews", Icon: Star, ability: "manage-reviews" },
      { href: "/notifications", label: "nav.notifications", Icon: MessageSquare, ability: "manage-notifications" },
    ],
  },
  {
    label: "nav.insight",
    items: [
      { href: "/rapports", label: "nav.reports", Icon: BarChart3, ability: "view-reports" },
      { href: "/audit", label: "nav.audit", Icon: ShieldCheck, ability: "view-audit" },
    ],
  },
  {
    label: "nav.tools",
    items: [
      { href: "/qrcodes", label: "nav.qrcodes", Icon: QrCode, ability: "generate-qrcodes" },
      { href: "/acces", label: "nav.access", Icon: KeyRound, superAdminOnly: true },
    ],
  },
];

export const VENDOR_NAV: NavGroup[] = [
  { label: "nav.general", items: [{ href: "/espace-vendeur", label: "nav.vendorSpace", Icon: UserRound }] },
];

/** Shortcuts of the top bar: the pages used all day. */
export const SHORTCUTS: NavItem[] = [
  { href: "/", label: "nav.dashboard", Icon: LayoutDashboard },
  { href: "/commandes", label: "nav.orders", Icon: ShoppingCart, ability: "manage-orders" },
  { href: "/ventes-internes", label: "nav.internalSales", Icon: ShoppingBasket, ability: "manage-internal-sales" },
  { href: "/produits", label: "nav.products", Icon: Package, ability: "manage-catalog" },
  { href: "/stock", label: "nav.stock", Icon: Boxes, ability: "manage-stock" },
  { href: "/factures", label: "nav.invoices", Icon: ReceiptText, ability: "manage-invoices" },
];

export const BELL_ICON = Bell;

export const SUPER_ADMIN_ROLE = "super_admin";

/** What a signed-in account has: its roles and, from the API, the features it may use. */
export interface Access {
  roles: readonly string[];
  /** Features the account may use; undefined while unknown (then nothing is hidden). */
  abilities?: readonly string[];
}

function allowed(item: NavItem, access: Access): boolean {
  if (item.superAdminOnly) return access.roles.includes(SUPER_ADMIN_ROLE);
  if (!item.ability || access.abilities === undefined) return true;

  return access.abilities.includes(item.ability);
}

/** The menu of this account: what it may not use is not shown at all, and a section left empty goes too. */
export function navFor(roles: readonly string[], abilities?: readonly string[]): NavGroup[] {
  if (isVendorOnly(roles)) return VENDOR_NAV;

  const access = { roles, abilities };

  return STAFF_NAV.map((group) => ({ ...group, items: group.items.filter((item) => allowed(item, access)) })).filter((group) => group.items.length > 0);
}

/** Whether the top bar's notification bell is for this account: staff only, and only with the Notifications feature on. */
export function canSeeNotifications(roles: readonly string[], abilities?: readonly string[]): boolean {
  if (isVendorOnly(roles)) return false;

  return abilities === undefined || abilities.includes("manage-notifications");
}

/** The shortcuts a user can see: a vendor-only account has no staff pages. */
export function shortcutsFor(roles: readonly string[], abilities?: readonly string[]): NavItem[] {
  if (isVendorOnly(roles)) return VENDOR_NAV[0].items;

  return SHORTCUTS.filter((item) => allowed(item, { roles, abilities }));
}

/** Whether this account is kept away from the page: a known feature page it may not use. */
export function isPageForbidden(pathname: string, access: Access): boolean {
  if (isVendorOnly(access.roles)) return false;

  const item = STAFF_NAV.flatMap((group) => group.items).find((candidate) => candidate.href !== "/" && isActive(candidate.href, pathname));

  return item !== undefined && !allowed(item, access);
}

/** Whether a menu entry is the current page ("/" only matches exactly). */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
