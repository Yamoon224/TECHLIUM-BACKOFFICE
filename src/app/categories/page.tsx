"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { ActionLabel } from "@/components/ActionLabel";
import { DataTable } from "@/components/DataTable";
import { LanguageTabs } from "@/components/LanguageTabs";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import {
  CatalogError,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type Category,
} from "@/lib/catalog";

export default function CategoriesPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | number | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listCategories(token)
      .then(setCategories)
      .catch((caught) => setError(caught instanceof CatalogError ? caught.message : tr("Catégories indisponibles.")))
      .finally(() => setLoading(false));
  }, [token, tr]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  async function handleCreate(input: CategoryFormValues) {
    if (!token) return;
    setError(null);
    try {
      const created = await createCategory(token, { ...input, name_en: input.name_en || undefined });
      setCategories((current) => [...current, created]);
      setForm(null);
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Création impossible."));
      throw caught;
    }
  }

  async function handleSave(id: number, patch: CategoryFormValues) {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateCategory(token, id, patch);
      setCategories((current) => current.map((category) => (category.id === id ? updated : category)));
      setForm(null);
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Mise à jour impossible."));
    }
  }

  async function handleToggle(category: Category) {
    if (!token) return;
    setError(null);
    try {
      const updated = await updateCategory(token, category.id, { is_active: !category.is_active });
      setCategories((current) => current.map((row) => (row.id === category.id ? updated : row)));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Mise à jour impossible."));
    }
  }

  async function handleDelete(id: number) {
    if (!token) return;
    setError(null);
    try {
      await deleteCategory(token, id);
      setCategories((current) => current.filter((category) => category.id !== id));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Suppression impossible."));
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux catégories.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Catégories")}</h1>
          <Button
            onClick={() => {
              setError(null);
              setForm("new");
            }}
          >
            <ActionLabel text={tr("Nouvelle catégorie")} />
          </Button>
        </div>

        {error && form === null ? <p className="text-sm text-danger">{error}</p> : null}

        {form !== null ? (
          <CategoryFormModal
            key={form}
            category={typeof form === "number" ? categories.find((c) => c.id === form) : undefined}
            categories={categories}
            onClose={() => setForm(null)}
            onSubmit={(input) => (typeof form === "number" ? handleSave(form, input) : handleCreate(input))}
            error={error}
          />
        ) : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucune catégorie.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="categories"
  rows={categories}
  headers={[tr("Nom"), tr("Slug"), tr("Parente"), tr("Produits"), tr("Active"), tr("Action")]}
  actionColumns={[5]}
  renderRow={(category) => (
                    <tr key={category.id} className="border-b border-line">
                      <td className="py-3 pr-4 text-ink">{category.name}</td>
                      <td className="py-3 pr-4 text-ink-soft">{category.slug}</td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {categories.find((c) => c.id === category.parent_id)?.name ?? "-"}
                      </td>
                      <td className="py-3 pr-4 text-ink">{category.product_count ?? 0}</td>
                      <td className="py-3 pr-4 text-ink-soft">{category.is_active ? tr("Oui") : tr("Non")}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setForm(category.id);
                            }}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                          >
                            <ActionLabel text={tr("Modifier")} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggle(category)}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold"
                          >
                            {category.is_active ? <ActionLabel text={tr("Désactiver")} /> : <ActionLabel text={tr("Activer")} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(category.id)}
                            className="rounded-sm border border-line px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                          >
                            <ActionLabel text={tr("Supprimer")} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
/>
          </div>
        )}
      </main>
    </div>
  );
}

interface CategoryFormValues {
  name: string;
  name_en: string;
  parent_id: number | null;
  position: number;
  is_active: boolean;
}

/** Create (no `category`) or edit a category in a dialog. */
function CategoryFormModal({
  category,
  categories,
  onClose,
  onSubmit,
  error,
}: {
  category?: Category;
  categories: Category[];
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
  error: string | null;
}) {
  const { tr } = useAppearance();
  const [name, setName] = useState(category?.name ?? "");
  const [nameEn, setNameEn] = useState(category?.name_en ?? "");
  const [parentId, setParentId] = useState(category?.parent_id ? String(category.parent_id) : "");
  const [position, setPosition] = useState(String(category?.position ?? 0));
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [submitting, setSubmitting] = useState(false);
  const fieldClass = "rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <FormModal
      open
      size="md"
      title={category ? tr("Modifier la catégorie") : tr("Nouvelle catégorie")}
      onClose={onClose}
      submitLabel={category ? tr("Enregistrer") : tr("Ajouter")}
      submitting={submitting}
      disabled={!name.trim()}
      error={error}
      onSubmit={async () => {
        setSubmitting(true);
        try {
          await onSubmit({
            name: name.trim(),
            name_en: nameEn.trim(),
            parent_id: parentId ? Number(parentId) : null,
            position: Number(position) || 0,
            is_active: isActive,
          });
        } catch {
          // error surfaced by the page, shown in the footer
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="grid gap-4">
        <LanguageTabs
          enFilled={Boolean(nameEn.trim())}
          fr={
            <label className="field">
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder={tr("Ex. Accessoires audio")} className={fieldClass} />
              <span className="field-label">{tr("Nom")}</span>
            </label>
          }
          en={
            <label className="field">
              <input value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder={tr("Ex. Audio accessories")} className={fieldClass} />
              <span className="field-label">{tr("Nom")}</span>
            </label>
          }
        />
        <label className="field">
          <SearchSelect value={parentId} onChange={(event) => setParentId(event.target.value)} className={fieldClass}>
            <option value="">{tr("Aucune")}</option>
            {categories
              .filter((candidate) => candidate.id !== category?.id)
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
          </SearchSelect>
          <span className="field-label">{tr("Catégorie parente")}</span>
        </label>
        <label className="field">
          <input type="number" min={0} value={position} onChange={(event) => setPosition(event.target.value)} className={fieldClass} />
          <span className="field-label">{tr("Position")}</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          {tr("Active")}
        </label>
      </div>
    </FormModal>
  );
}
