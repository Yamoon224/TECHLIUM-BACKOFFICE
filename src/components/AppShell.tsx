"use client";

import { Bell, ChevronsUpDown, LogOut, Menu, Moon, Settings, Sun, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser, logout as logoutRequest, TOKEN_STORAGE_KEY, type User } from "@/lib/auth";
import { canSeeNotifications, isActive, isPageForbidden, navFor, shortcutsFor, type NavGroup, type NavItem } from "@/lib/navigation";
import { listNotifications } from "@/lib/notifications";
import { isVendorOnly, ROLE_LABEL } from "@/lib/roles";
import { AUTH_CHANGED_EVENT } from "@/lib/useAuth";
import { useAppearance } from "./AppearanceProvider";
import { OrderAlerts } from "./OrderAlerts";
import { AbilitiesContext } from "./QrLink";
import { SettingsPanel } from "./SettingsPanel";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_COLLAPSED_WIDTH = "4.5rem";

/**
 * The application chrome: sidebar (or horizontal menu), top bar with shortcuts
 * and the settings drawer, around every page. It reads the session itself and
 * draws nothing for a signed-out visitor, so the login screen stays bare.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { appearance, update } = useAppearance();
  const [session, setSession] = useState<{ token: string; user: User } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [failedMessages, setFailedMessages] = useState(0);

  const readSession = useCallback(() => {
    let token: string | null = null;
    try {
      token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      token = null;
    }

    if (!token) {
      setSession(null);
      return;
    }

    fetchCurrentUser(token)
      .then((user) => setSession({ token, user }))
      .catch(() => setSession(null));
  }, []);

  useEffect(() => {
    // The token only exists in the browser, hence after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    readSession();

    window.addEventListener(AUTH_CHANGED_EVENT, readSession);
    window.addEventListener("storage", readSession);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, readSession);
      window.removeEventListener("storage", readSession);
    };
  }, [readSession]);

  const token = session?.token ?? null;
  const showOrderAlerts = session ? !isVendorOnly(session.user.roles) && (session.user.abilities === undefined || session.user.abilities.includes("manage-orders")) : false;
  const showBell = session ? canSeeNotifications(session.user.roles, session.user.abilities) : false;

  useEffect(() => {
    // Failed customer messages need a look: shown on the bell, for the accounts that have it.
    if (!token || !showBell) return;

    let cancelled = false;
    listNotifications(token, { status: "failed" })
      .then((failed) => !cancelled && setFailedMessages(failed.length))
      .catch(() => !cancelled && setFailedMessages(0));

    return () => {
      cancelled = true;
    };
  }, [token, showBell, pathname]);

  useEffect(() => {
    // Close the mobile drawer when the page changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (session) await logoutRequest(session.token).catch(() => undefined);
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // nothing to clear
    }
    // A full reload on purpose: every page keeps its own copy of the session, which must not outlive the logout.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  if (!session) return <>{children}</>;

  const side = appearance.layout === "side";
  const sidebarWidth = appearance.collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const groups = navFor(session.user.roles, session.user.abilities);
  const forbidden = isPageForbidden(pathname, { roles: session.user.roles, abilities: session.user.abilities });

  return (
    <div style={{ "--sidebar-w": side ? sidebarWidth : "0rem" } as React.CSSProperties} className="min-h-screen">
      {side ? (
        <Sidebar
          groups={groups}
          user={session.user}
          collapsed={appearance.collapsed}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onLogout={handleLogout}
        />
      ) : null}

      <div className={`flex min-h-screen flex-col ${side ? "lg:pl-[var(--sidebar-w)]" : ""} transition-[padding] duration-200`}>
        <Topbar
          user={session.user}
          groups={groups}
          horizontal={!side}
          failedMessages={failedMessages}
          showBell={showBell}
          orderToken={showOrderAlerts ? session.token : null}
          onToggleMenu={() => {
            if (window.matchMedia("(min-width: 1024px)").matches) return update({ collapsed: !appearance.collapsed });
            setMobileMenuOpen((open) => !open);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={handleLogout}
        />
        <div className="flex flex-1 flex-col">{forbidden ? <FeatureUnavailable /> : <AbilitiesContext.Provider value={session.user.abilities}>{children}</AbilitiesContext.Provider>}</div>
      </div>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );

}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { t } = useAppearance();

  return (
    <Link href="/" className="flex items-center gap-3 overflow-hidden">
      <Image src="/icon-192.png" alt="" width={40} height={40} priority className="h-10 w-10 shrink-0 rounded-md" />
      {collapsed ? null : (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-base font-semibold">TechLium</span>
          <span className="text-xs opacity-70">{t("shell.workspace")}</span>
        </span>
      )}
    </Link>
  );
}

function Sidebar({
  groups,
  user,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: {
  groups: NavGroup[];
  user: User;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { t, tr } = useAppearance();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      {mobileOpen ? <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onCloseMobile} aria-hidden /> : null}

      <aside
        style={{ backgroundColor: "var(--shell-sidebar-bg)", color: "var(--shell-sidebar-fg)" }}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line transition-all duration-200 lg:w-[var(--sidebar-w)] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div
          style={{ backgroundColor: "var(--shell-sidebar-top-bg)", color: "var(--shell-sidebar-top-fg)" }}
          className="flex h-16 shrink-0 items-center border-b border-line px-4"
        >
          <Brand collapsed={collapsed} />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label={tr("Navigation")}>
          {groups.map((group) => (
            <div key={group.label} className="mb-4">
              {collapsed ? (
                <hr className="mx-2 mb-2 border-line" />
              ) : (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide opacity-60">{t(group.label)}</p>
              )}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} active={isActive(item.href, pathname)} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="relative shrink-0 border-t border-line p-3">
          {menuOpen ? (
            <button
              type="button"
              onClick={onLogout}
              className="absolute bottom-full left-3 right-3 mb-2 flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink shadow-lg hover:border-gold"
            >
              <LogOut className="h-4 w-4" aria-hidden /> {t("shell.logout")}
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            className="flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold-bright">
              <UserRound className="h-5 w-5" aria-hidden />
            </span>
            {collapsed ? null : (
              <>
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">{user.name}</span>
                  <span className="truncate text-xs opacity-70">{roleLabel(user, tr)}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function roleLabel(user: User, tr: (french: string) => string): string {
  return user.roles.map((role) => tr(ROLE_LABEL[role] ?? role))[0] ?? "";
}

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const { t } = useAppearance();

  return (
    <Link
      href={item.href}
      title={collapsed ? t(item.label) : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${collapsed ? "justify-center" : ""} ${
        active ? "bg-gold/15 font-medium text-gold-bright" : "opacity-85 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
      }`}
    >
      <item.Icon className="h-5 w-5 shrink-0" aria-hidden />
      {collapsed ? <span className="sr-only">{t(item.label)}</span> : t(item.label)}
    </Link>
  );
}

function Topbar({
  user,
  groups,
  horizontal,
  failedMessages,
  showBell,
  orderToken,
  onToggleMenu,
  onOpenSettings,
  onLogout,
}: {
  user: User;
  groups: NavGroup[];
  horizontal: boolean;
  failedMessages: number;
  showBell: boolean;
  /** Session token when this account gets the new-order alerts, else null. */
  orderToken: string | null;
  onToggleMenu: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const { theme, update, t, tr } = useAppearance();
  const [accountOpen, setAccountOpen] = useState(false);
  const shortcuts = shortcutsFor(user.roles, user.abilities);
  const items = horizontal ? groups.flatMap((group) => group.items) : shortcuts;

  return (
    <header
      style={{ backgroundColor: "var(--shell-topbar-bg)", color: "var(--shell-topbar-fg)" }}
      className="sticky top-0 z-20 border-b border-line"
    >
      <div className="flex h-16 items-center gap-3 px-4">
        {horizontal ? (
          <div className="mr-2 hidden sm:block">
            <Brand collapsed={false} />
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleMenu}
            aria-label={t("shell.toggleMenu")}
            className="rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        )}

        {horizontal ? null : (
          <nav className="hidden items-center gap-1 border-l border-line pl-3 md:flex" aria-label={tr("Raccourcis")}>
            {items.map((item) => (
              <ShortcutLink key={item.href} item={item} active={isActive(item.href, pathname)} />
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1">
          {showBell ? (
          <Link
            href="/notifications"
            aria-label={`${t("shell.notifications")}${failedMessages > 0 ? ` - ${failedMessages} ${t("shell.failedMessages")}` : ""}`}
            className="relative rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {failedMessages > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                {failedMessages > 99 ? "99+" : failedMessages}
              </span>
            ) : null}
          </Link>
          ) : null}

          <button
            type="button"
            onClick={() => update({ theme: theme === "dark" ? "light" : "dark" })}
            aria-label={t("shell.toggleTheme")}
            className="rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
          </button>

          {orderToken ? <OrderAlerts token={orderToken} /> : null}

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={t("shell.settings")}
            className="rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Settings className="h-5 w-5" aria-hidden />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((open) => !open)}
              aria-label={t("shell.account")}
              aria-expanded={accountOpen}
              className="rounded-sm p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <UserRound className="h-6 w-6" aria-hidden />
            </button>

            {accountOpen ? (
              <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-sm border border-line bg-surface p-2 text-ink shadow-lg">
                <p className="truncate px-2 pt-1 text-sm font-medium">{user.name}</p>
                <p className="truncate px-2 pb-2 text-xs text-ink-soft">{user.email ?? roleLabel(user, tr)}</p>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-bg"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> {t("shell.logout")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {horizontal ? (
        <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-1.5" aria-label={tr("Navigation")}>
          {items.map((item) => (
            <ShortcutLink key={item.href} item={item} active={isActive(item.href, pathname)} />
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function ShortcutLink({ item, active }: { item: NavItem; active: boolean }) {
  const { t } = useAppearance();

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${
        active ? "bg-gold/15 font-medium text-gold-bright" : "opacity-85 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/5"
      }`}
    >
      <item.Icon className="h-4 w-4 shrink-0" aria-hidden />
      {t(item.label)}
    </Link>
  );
}

/** Shown instead of a page whose feature is not available to this account (it is not in the menu either). */
function FeatureUnavailable() {
  const { tr } = useAppearance();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Fonctionnalité indisponible")}</h1>
      <p className="max-w-md text-sm text-ink-soft">{tr("Cette fonctionnalité n'est pas activée pour votre compte. Contactez le super administrateur si vous en avez besoin.")}</p>
      <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
        {tr("Retour à l'accueil")}
      </Link>
    </main>
  );
}
