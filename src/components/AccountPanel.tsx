import { ActionLabel } from "@/components/ActionLabel";
import type { User } from "@/lib/auth";
import { useAppearance } from "./AppearanceProvider";
import { ROLE_LABEL } from "@/lib/roles";


export function AccountPanel({ user, onLogout }: { user: User; onLogout: () => void }) {
  const { t, tr } = useAppearance();

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-sm border border-line bg-surface p-6 shadow-card border-b-4 border-b-gold">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-ink-soft">{t("account.connected")}</p>
        <h1 className="text-lg font-medium text-ink">{user.name}</h1>
        {user.email ? <p className="text-sm text-ink-soft">{user.email}</p> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {user.roles.map((role) => (
          <span
            key={role}
            className="rounded-full border border-gold-deep px-3 py-1 text-xs text-gold-bright"
          >
            {tr(ROLE_LABEL[role] ?? role)}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="rounded-sm border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-gold"
      >
        <ActionLabel text={t("shell.logout")} />
      </button>
    </div>
  );
}
