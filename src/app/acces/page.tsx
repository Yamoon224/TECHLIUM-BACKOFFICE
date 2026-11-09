"use client";

import { ActionLabel } from "@/components/ActionLabel";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppearance } from "@/components/AppearanceProvider";
import { Button } from "@/components/Button";
import { FormModal } from "@/components/Modal";
import { DataTable } from "@/components/DataTable";
import {
  AccessError,
  assignableGroups,
  assignRoles,
  createGroup,
  deleteGroup,
  featuresBySection,
  listAccessUsers,
  loadAccess,
  nextSwitch,
  setSwitch,
  switchFor,
  toggled,
  updateGroup,
  withSwitch,
  type AccessFeature,
  type AccessGroup,
  type AccessOverview,
  type AccessSwitch,
  type AccessUser,
  type SubjectType,
} from "@/lib/access";
import { SUPER_ADMIN_ROLE } from "@/lib/navigation";
import { useAuth } from "@/lib/useAuth";

type Tab = "features" | "groups" | "users";

export default function AccessPage() {
  const { tr } = useAppearance();
  const { status, token, user } = useAuth();
  const [tab, setTab] = useState<Tab>("features");
  const [overview, setOverview] = useState<AccessOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!token) return;

    loadAccess(token)
      .then(setOverview)
      .catch((caught) => setError(caught instanceof AccessError ? caught.message : tr("Chargement impossible.")));
  }, [token, tr]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (status === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour gérer les accès.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  if (!user?.roles.includes(SUPER_ADMIN_ROLE)) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Accès réservé")}</h1>
        <p className="max-w-md text-sm text-ink-soft">{tr("Seul le super administrateur gère les fonctionnalités, les groupes et les droits.")}</p>
      </main>
    );
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "features", label: tr("Fonctionnalités") },
    { value: "groups", label: tr("Groupes") },
    { value: "users", label: tr("Utilisateurs") },
  ];

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Accès et groupes")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-soft">
          {tr("Activez ou désactivez une fonctionnalité pour un groupe ou un utilisateur, y compris l'administrateur : elle disparaît alors complètement de son interface et l'API la refuse. Créez vos propres groupes et choisissez leurs droits.")}
        </p>
      </div>

      <div role="tablist" className="flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === item.value ? "border-gold font-medium text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {overview === null ? (
        <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
      ) : tab === "features" ? (
        <FeaturesTab token={token} overview={overview} onChange={(switches) => setOverview({ ...overview, switches })} onError={setError} />
      ) : tab === "groups" ? (
        <GroupsTab token={token} overview={overview} onReload={reload} onError={setError} />
      ) : (
        <UsersTab token={token} overview={overview} onChange={(switches) => setOverview({ ...overview, switches })} onReload={reload} onError={setError} />
      )}
    </main>
  );
}

function useLabels() {
  const { appearance } = useAppearance();
  const english = appearance.language === "en";

  return {
    english,
    featureLabel: (feature: AccessFeature) => (english ? feature.label_en : feature.label),
  };
}

function message(caught: unknown, fallback: string): string {
  return caught instanceof AccessError ? caught.message : fallback;
}

/** Features × groups: switch a feature off (or back on) for a whole group in one click. */
function FeaturesTab({
  token,
  overview,
  onChange,
  onError,
}: {
  token: string;
  overview: AccessOverview;
  onChange: (switches: AccessSwitch[]) => void;
  onError: (message: string | null) => void;
}) {
  const { tr } = useAppearance();
  const { english, featureLabel } = useLabels();
  const groups = overview.groups.filter((group) => group.name !== "client" && group.name !== SUPER_ADMIN_ROLE);

  async function toggle(feature: string, group: AccessGroup) {
    const next = nextSwitch(switchFor(overview.switches, feature, "role", group.name), "role");
    onError(null);
    try {
      await setSwitch(token, feature, "role", group.name, next);
      onChange(withSwitch(overview.switches, { feature, subject_type: "role", subject: group.name, enabled: next }));
    } catch (caught) {
      onError(message(caught, tr("Modification impossible.")));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-soft">
        {tr("Cliquez pour désactiver une fonctionnalité pour tout un groupe ; cliquez à nouveau pour la rétablir. Le super administrateur n'est jamais restreint.")}
      </p>
      <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-2 pr-4 font-medium text-ink">{tr("Fonctionnalité")}</th>
              {groups.map((group) => (
                <th key={group.name} className="px-2 py-2 text-center text-xs font-medium text-ink">
                  {tr(group.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {featuresBySection(overview.features, english).map(({ section, features }) => (
              <SectionRows key={section} section={section} features={features} columns={groups.length + 1}>
                {(feature) => (
                  <tr key={feature.key} className="border-b border-line">
                    <td className="py-2 pr-4 text-ink">{featureLabel(feature)}</td>
                    {groups.map((group) => {
                      const off = switchFor(overview.switches, feature.key, "role", group.name) === false;
                      const granted = group.permissions.includes(feature.key);

                      return (
                        <td key={group.name} className="px-2 py-2 text-center">
                          {off || granted ? (
                            <button
                              type="button"
                              onClick={() => void toggle(feature.key, group)}
                              aria-pressed={!off}
                              aria-label={`${featureLabel(feature)} - ${tr(group.label)}`}
                              className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                                off ? "bg-red-600/15 text-danger" : "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {off ? <ActionLabel text={tr("Désactivée")} /> : <ActionLabel text={tr("Activée")} />}
                            </button>
                          ) : (
                            <span className="text-ink-soft" title={tr("Ce groupe n'a pas cette fonctionnalité")}>
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </SectionRows>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionRows({
  section,
  features,
  columns,
  children,
}: {
  section: string;
  features: AccessFeature[];
  columns: number;
  children: (feature: AccessFeature) => React.ReactNode;
}) {
  const { tr } = useAppearance();

  return (
    <>
      <tr>
        <td colSpan={columns} className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          {tr(section)}
        </td>
      </tr>
      {features.map((feature) => children(feature))}
    </>
  );
}

/** Ticks of the features of a group, by section. */
function FeaturePicker({ features, value, onChange }: { features: AccessFeature[]; value: string[]; onChange: (value: string[]) => void }) {
  const { tr } = useAppearance();
  const { english, featureLabel } = useLabels();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {featuresBySection(features, english).map(({ section, features: inSection }) => (
        <fieldset key={section} className="flex flex-col gap-1.5">
          <legend className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{tr(section)}</legend>
          {inSection.map((feature) => (
            <label key={feature.key} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={value.includes(feature.key)} onChange={() => onChange(toggled(value, feature.key))} />
              {featureLabel(feature)}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function GroupFormModal({
  token,
  group,
  features,
  onClose,
  onSaved,
}: {
  token: string;
  group?: AccessGroup;
  features: AccessFeature[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr } = useAppearance();
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(group?.permissions ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormModal
      open
      size="lg"
      title={group ? tr("Modifier le groupe") : tr("Nouveau groupe")}
      onClose={onClose}
      submitLabel={tr("Enregistrer")}
      submitting={busy}
      disabled={label.trim().length < 2}
      error={error}
      onSubmit={async () => {
        setBusy(true);
        setError(null);
        const input = { label: label.trim(), description: description.trim() || null, permissions };
        try {
          if (group) await updateGroup(token, group.name, input);
          else await createGroup(token, input);
          onSaved();
          onClose();
        } catch (caught) {
          setError(message(caught, tr("Enregistrement impossible.")));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-4">
        <label className="field">
          <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={tr("Ex. Caisse boutique")} required minLength={2} maxLength={60} />
          <span className="field-label">{tr("Nom du groupe")}</span>
        </label>
        <label className="field">
          <input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={tr("Ex. Encaissement et suivi des commandes")} maxLength={500} />
          <span className="field-label">{tr("Description (optionnel)")}</span>
        </label>

        <div>
          <p className="pb-2 text-sm font-medium text-ink">{tr("Fonctionnalités accordées")}</p>
          <FeaturePicker features={features} value={permissions} onChange={setPermissions} />
        </div>
      </div>
    </FormModal>
  );
}

function GroupsTab({ token, overview, onReload, onError }: { token: string; overview: AccessOverview; onReload: () => void; onError: (message: string | null) => void }) {
  const { tr } = useAppearance();
  const [editing, setEditing] = useState<AccessGroup | "new" | null>(null);

  function open(group: AccessGroup | "new") {
    setEditing(group);
    onError(null);
  }

  async function remove(group: AccessGroup) {
    if (!window.confirm(tr("Supprimer ce groupe ?"))) return;
    onError(null);
    try {
      await deleteGroup(token, group.name);
      onReload();
    } catch (caught) {
      onError(message(caught, tr("Suppression impossible.")));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button type="button" onClick={() => open("new")}>
          <ActionLabel text={tr("Nouveau groupe")} />
        </Button>
      </div>

      {editing ? (
        <GroupFormModal
          key={editing === "new" ? "new" : editing.name}
          token={token}
          group={editing === "new" ? undefined : editing}
          features={overview.features}
          onClose={() => setEditing(null)}
          onSaved={onReload}
        />
      ) : null}

      <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
        <DataTable
          name="groupes"
          rows={overview.groups}
          headers={[tr("Groupe"), tr("Type"), tr("Membres"), tr("Fonctionnalités"), tr("Action")]}
          actionColumns={[4]}
          renderRow={(group) => (
            <tr key={group.name} className="border-b border-line">
              <td className="py-3 pr-4 text-ink">
                {tr(group.label)}
                {group.description ? <span className="block text-xs text-ink-soft">{group.description}</span> : null}
              </td>
              <td className="py-3 pr-4 text-ink-soft">{group.builtin ? tr("Profil d'origine") : tr("Personnalisé")}</td>
              <td className="py-3 pr-4 text-ink-soft">{group.members}</td>
              <td className="py-3 pr-4 text-ink-soft">{group.permissions.length}</td>
              <td className="py-3">
                {group.builtin ? (
                  <span className="text-xs text-ink-soft">{tr("Verrouillé")}</span>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => open(group)} className="rounded-sm border border-gold px-2 py-1 text-xs text-gold">
                      <ActionLabel text={tr("Modifier")} />
                    </button>
                    <button type="button" onClick={() => void remove(group)} className="rounded-sm border border-line px-2 py-1 text-xs text-ink-soft hover:border-danger hover:text-danger">
                      <ActionLabel text={tr("Supprimer")} />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}

function UsersTab({
  token,
  overview,
  onChange,
  onReload,
  onError,
}: {
  token: string;
  overview: AccessOverview;
  onChange: (switches: AccessSwitch[]) => void;
  onReload: () => void;
  onError: (message: string | null) => void;
}) {
  const { tr } = useAppearance();
  const { english, featureLabel } = useLabels();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AccessUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    listAccessUsers(token, search)
      .then(setUsers)
      .catch((caught) => onError(message(caught, tr("Chargement impossible."))));
  }, [token, search, onError, tr]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = users.find((candidate) => candidate.id === selectedId) ?? null;

  function pick(user: AccessUser) {
    setSelectedId(user.id);
    setRoles(user.roles);
    onError(null);
  }

  async function saveRoles(user: AccessUser) {
    setBusy(true);
    onError(null);
    try {
      await assignRoles(token, user.id, roles);
      refresh();
      onReload();
    } catch (caught) {
      onError(message(caught, tr("Enregistrement impossible.")));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFeature(user: AccessUser, feature: string) {
    const current = user.switches[feature] ?? null;
    const next = nextSwitch(current, "user");
    onError(null);
    try {
      await setSwitch(token, feature, "user", String(user.id), next);
      setUsers((rows) =>
        rows.map((row) => {
          if (row.id !== user.id) return row;
          const switches = { ...row.switches };
          if (next === null) delete switches[feature];
          else switches[feature] = next;
          return { ...row, switches };
        }),
      );
      onChange(withSwitch(overview.switches, { feature, subject_type: "user" as SubjectType, subject: String(user.id), enabled: next }));
    } catch (caught) {
      onError(message(caught, tr("Modification impossible.")));
    }
  }

  const groupLabel = (name: string) => overview.groups.find((group) => group.name === name)?.label ?? name;

  return (
    <div className="flex flex-col gap-6">
      <label className="field max-w-sm">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tr("Ex. Awa ou awa@exemple.com")} />
        <span className="field-label">{tr("Rechercher un compte")}</span>
      </label>

      <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
        <DataTable
          name="utilisateurs"
          rows={users}
          headers={[tr("Nom"), tr("E-mail"), tr("Groupes"), tr("Fonctionnalités désactivées"), tr("Action")]}
          actionColumns={[4]}
          renderRow={(row) => (
            <tr key={row.id} className="border-b border-line">
              <td className="py-3 pr-4 text-ink">{row.name}</td>
              <td className="py-3 pr-4 text-ink-soft">{row.email ?? "-"}</td>
              <td className="py-3 pr-4 text-ink-soft">{row.roles.map((role) => tr(groupLabel(role))).join(", ")}</td>
              <td className="py-3 pr-4 text-ink-soft">{Object.values(row.switches).filter((enabled) => !enabled).length}</td>
              <td className="py-3">
                <button type="button" onClick={() => pick(row)} className="rounded-sm border border-gold px-2 py-1 text-xs text-gold">
                  <ActionLabel text={tr("Gérer")} />
                </button>
              </td>
            </tr>
          )}
        />
      </div>

      {selected ? (
        <section className="flex flex-col gap-5 rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
          <h2 className="section-title font-display text-lg font-semibold text-ink">{selected.name}</h2>

          <div>
            <p className="pb-2 text-sm font-medium text-ink">{tr("Groupes de ce compte")}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[...assignableGroups(overview.groups)].map((group) => (
                <label key={group.name} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={roles.includes(group.name)} onChange={() => setRoles(toggled(roles, group.name))} />
                  {tr(group.label)}
                </label>
              ))}
            </div>
            <Button type="button" className="mt-3" disabled={busy || roles.length === 0} onClick={() => void saveRoles(selected)}>
              <ActionLabel text={tr("Enregistrer les groupes")} />
            </Button>
          </div>

          <div>
            <p className="pb-1 text-sm font-medium text-ink">{tr("Fonctionnalités de ce compte")}</p>
            <p className="pb-3 text-xs text-ink-soft">
              {tr("Un clic désactive, un deuxième clic force l'activation (même si son groupe l'a perdue), un troisième revient au réglage du groupe.")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuresBySection(overview.features, english).map(({ section, features }) => (
                <div key={section} className="flex flex-col gap-1.5">
                  <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{tr(section)}</p>
                  {features.map((feature) => (
                    <FeatureSwitch key={feature.key} label={featureLabel(feature)} state={selected.switches[feature.key] ?? null} onClick={() => void toggleFeature(selected, feature.key)} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function FeatureSwitch({ label, state, onClick }: { label: string; state: boolean | null; onClick: () => void }) {
  const { tr } = useAppearance();
  const tone = state === false ? "bg-red-600/15 text-danger" : state === true ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400" : "bg-bg text-ink-soft";

  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex items-center justify-between gap-3 rounded-sm border border-line px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:border-gold">
      <span>{label}</span>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${tone}`}>{state === false ? tr("Désactivée") : state === true ? tr("Forcée") : tr("Selon le groupe")}</span>
    </button>
  );
}
