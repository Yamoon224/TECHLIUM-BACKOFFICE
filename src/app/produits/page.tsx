"use client";

import { SearchSelect } from "@/components/SearchSelect";
import { ActionLabel } from "@/components/ActionLabel";
import { QrLink } from "@/components/QrLink";
import { DataTable } from "@/components/DataTable";
import { Dropzone } from "@/components/Dropzone";
import { LanguageTabs } from "@/components/LanguageTabs";
import { FormModal } from "@/components/Modal";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { ProductImportModal } from "@/components/ProductImportModal";
import { useAuth } from "@/lib/useAuth";
import {
  CatalogError,
  addProductImage,
  archiveProduct,
  createProduct,
  imageProblem,
  MAX_GALLERY_IMAGES,
  listCategories,
  listAllProducts,
  removeProductImage,
  setProductCover,
  updateProduct,
  type Category,
  type Product,
} from "@/lib/catalog";

const STATUS_LABEL: Record<Product["status"], string> = {
  draft: "Brouillon",
  published: "Publié",
  archived: "Archivé",
};

const FIELD_CLASS = "rounded-sm border border-line bg-surface px-3 text-sm text-ink focus:border-gold focus:outline-none";
const BUTTON_CLASS = "rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold";

/** The product form is open for a new product ("new"), for one being edited (its id), or closed. */
type FormTarget = "new" | number | null;

export default function ProductsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, logout } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormTarget>(null);
  const [view, setView] = useState<"table" | "cards">("table");

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    Promise.all([listAllProducts(token), listCategories(token)])
      .then(([productList, categoryList]) => {
        setProducts(productList);
        setCategories(categoryList);
      })
      .catch((caught) => setError(caught instanceof CatalogError ? caught.message : tr("Produits indisponibles.")))
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

  function replaceProduct(updated: Product) {
    setProducts((current) => current.map((p) => (p.id === updated.id ? updated : p)));
  }

  function openForm(target: FormTarget) {
    setError(null);
    setForm(target);
  }

  async function handlePhoto(product: Product, picked: File[]) {
    if (!token || picked.length === 0) return;
    // Only what still fits in the gallery.
    const files = picked.slice(0, Math.max(0, MAX_GALLERY_IMAGES - (product.images?.length ?? 0)));
    const problem = files.map(imageProblem).find(Boolean);
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);
    try {
      // One request per file; the gallery shows each photo as soon as it is stored.
      for (const file of files) replaceProduct(await addProductImage(token, product.id, file));
    } catch (caught) {
      setError(
        caught instanceof CatalogError
          ? (caught.fieldErrors?.image?.[0] ?? caught.message)
          : tr("Envoi de la photo impossible."),
      );
    }
  }

  async function handleCover(product: Product, imageId: number) {
    if (!token) return;
    setError(null);
    try {
      replaceProduct(await setProductCover(token, product.id, imageId));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Changement de couverture impossible."));
    }
  }

  async function handleRemovePhoto(product: Product, imageId: number) {
    if (!token) return;
    setError(null);
    try {
      replaceProduct(await removeProductImage(token, product.id, imageId));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Suppression de la photo impossible."));
    }
  }

  /** Activate (published, visible on the marketplace) or deactivate (draft, hidden) a product. */
  async function handleToggle(product: Product) {
    if (!token) return;
    setError(null);
    try {
      replaceProduct(await updateProduct(token, product.id, { status: product.status === "published" ? "draft" : "published" }));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Mise à jour impossible."));
    }
  }

  async function handleArchive(id: number) {
    if (!token) return;
    setError(null);
    try {
      const updated = await archiveProduct(token, id);
      setProducts((current) => current.map((product) => (product.id === id ? updated : product)));
    } catch (caught) {
      setError(caught instanceof CatalogError ? caught.message : tr("Archivage impossible."));
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux produits.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  const editedProduct = typeof form === "number" ? products.find((product) => product.id === form) : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Produits")}</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <ActionLabel text={tr("Importer")} />
            </Button>
            <Button onClick={() => openForm("new")}><ActionLabel text={tr("Nouveau produit")} /></Button>
          </div>
        </div>

        <ProductImportModal open={importing} token={token} categories={categories} onClose={() => setImporting(false)} onImported={refresh} />

        {error && form === null ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex gap-2" role="group" aria-label={tr("Affichage")}>
          {(["table", "cards"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
              className={`rounded-sm border px-3 py-1 text-xs transition-colors ${
                view === mode ? "border-gold text-gold" : "border-line text-ink hover:border-gold"
              }`}
            >
              {mode === "table" ? <ActionLabel text={tr("Tableau")} /> : <ActionLabel text={tr("Cartes")} />}
            </button>
          ))}
        </div>

        {form === "new" || editedProduct ? (
          <ProductFormModal
            // A fresh form (and fresh fields) for every product opened.
            key={editedProduct?.id ?? "new"}
            product={editedProduct}
            categories={categories}
            externalError={error}
            onClose={() => setForm(null)}
            onCreate={async ({ photos, extra, ...input }) => {
              if (!token) return;
              let created = await createProduct(token, input);
              try {
                // English texts are not part of the creation request.
                if (extra.name_en || extra.description_en) created = await updateProduct(token, created.id, extra);
                // The first photo is the cover.
                for (const photo of photos) created = await addProductImage(token, created.id, photo);
              } catch (caught) {
                // The product exists: it is listed, and the rest can be finished by editing it.
                setProducts((current) => [created, ...current]);
                setForm(created.id);
                throw caught instanceof CatalogError
                  ? new CatalogError(tr("Produit créé, mais un élément n'a pas pu être enregistré : ") + (caught.fieldErrors?.image?.[0] ?? caught.message))
                  : new CatalogError(tr("Produit créé, mais l'envoi de la photo a échoué."));
              }
              setProducts((current) => [created, ...current]);
              setForm(null);
            }}
            onSave={async (patch) => {
              if (!token || !editedProduct) return;
              replaceProduct(await updateProduct(token, editedProduct.id, patch));
              setForm(null);
            }}
            onAddPhoto={(files) => editedProduct && handlePhoto(editedProduct, files)}
            onCover={(imageId) => editedProduct && handleCover(editedProduct, imageId)}
            onRemovePhoto={(imageId) => editedProduct && handleRemovePhoto(editedProduct, imageId)}
          />
        ) : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun produit.")}</p>
        ) : view === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => openForm(product.id)}
                onToggle={() => handleToggle(product)}
                onArchive={() => handleArchive(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
              name="produits"
              rows={products}
              headers={[tr("Produit"), tr("SKU"), tr("Prix"), tr("Stock"), tr("Statut"), tr("Action")]}
              actionColumns={[5]}
              renderRow={(product) => (
                <tr key={product.id} className="border-b border-line">
                  <td className="py-3 pr-4 text-ink">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        title={tr("Modifier")}
                        aria-label={tr("Modifier")}
                        onClick={() => openForm(product.id)}
                        className="shrink-0 rounded-sm transition-opacity hover:opacity-80"
                      >
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt="" className="h-10 w-10 rounded-sm border border-line object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-dashed border-line text-[10px] text-ink-soft">
                            {tr("Aucune")}
                          </span>
                        )}
                      </button>
                      {product.brand} {product.name}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-ink-soft">{product.sku ?? "-"}</td>
                  <td className="py-3 pr-4 text-ink">
                    {product.price_amount?.toLocaleString("fr-FR") ?? "-"} {product.currency}
                  </td>
                  <td className="py-3 pr-4 text-ink">{product.stock_quantity ?? "-"}</td>
                  <td className="py-3 pr-4 text-ink-soft">{tr(STATUS_LABEL[product.status])}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {product.sku ? <QrLink kind="product" reference={product.sku} /> : null}
                      <button type="button" onClick={() => openForm(product.id)} className={BUTTON_CLASS}>
                        <ActionLabel text={tr("Modifier")} />
                      </button>
                      <button type="button" onClick={() => handleToggle(product)} className={BUTTON_CLASS}>
                        <ActionLabel text={product.status === "published" ? tr("Désactiver") : tr("Activer")} />
                      </button>
                      {product.status !== "archived" ? (
                        <button
                          type="button"
                          onClick={() => handleArchive(product.id)}
                          className="rounded-sm border border-line px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
                        >
                          <ActionLabel text={tr("Archiver")} />
                        </button>
                      ) : null}
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

function ProductCard({ product, onEdit, onToggle, onArchive }: { product: Product; onEdit: () => void; onToggle: () => void; onArchive: () => void }) {
  const { tr } = useAppearance();

  return (
    <article className="flex flex-col gap-3 rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
      <button
        type="button"
        title={tr("Modifier")}
        aria-label={tr("Modifier")}
        onClick={onEdit}
        className="block overflow-hidden rounded-sm border border-line transition-opacity hover:opacity-80"
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <span className="flex aspect-square w-full items-center justify-center text-xs text-ink-soft">{tr("Aucune")}</span>
        )}
      </button>

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-ink">
          {product.brand} {product.name}
        </h2>
        <p className="text-xs text-ink-soft">{product.sku ?? "-"}</p>
        <p className="text-sm text-ink">
          {product.price_amount?.toLocaleString("fr-FR") ?? "-"} {product.currency}
          <span className="text-ink-soft">
            {" "}
            · {tr("Stock")} {product.stock_quantity ?? "-"}
          </span>
        </p>
        <p className="text-xs text-ink-soft">{tr(STATUS_LABEL[product.status])}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {product.sku ? <QrLink kind="product" reference={product.sku} /> : null}
        <button type="button" onClick={onEdit} className={BUTTON_CLASS}>
          <ActionLabel text={tr("Modifier")} />
        </button>
        <button type="button" onClick={onToggle} className={BUTTON_CLASS}>
          <ActionLabel text={product.status === "published" ? tr("Désactiver") : tr("Activer")} />
        </button>
        {product.status !== "archived" ? (
          <button
            type="button"
            onClick={onArchive}
            className="rounded-sm border border-line px-2 py-1 text-xs text-danger transition-colors hover:border-danger"
          >
            <ActionLabel text={tr("Archiver")} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

interface NewProductInput {
  category_id: number;
  brand: string;
  name: string;
  description?: string;
  price_amount: number;
  stock_quantity: number;
  photos: File[];
  extra: { name_en: string; description_en: string };
}

interface ProductPatch {
  category_id: number;
  brand: string;
  name: string;
  price_amount: number;
  stock_quantity: number;
  name_en: string;
  description: string;
  description_en: string;
}

/**
 * Create (no `product`) or edit a product in one dialog: identity, price and
 * stock, texts in both languages, and the photos. In edit mode the photo
 * buttons act at once (the gallery is stored as it changes); the rest is saved
 * with the footer button.
 */
function ProductFormModal({
  product,
  categories,
  externalError,
  onClose,
  onCreate,
  onSave,
  onAddPhoto,
  onCover,
  onRemovePhoto,
}: {
  product?: Product;
  categories: Category[];
  /** Page-level message (photo actions) shown in the footer. */
  externalError: string | null;
  onClose: () => void;
  onCreate: (input: NewProductInput) => Promise<void>;
  onSave: (patch: ProductPatch) => Promise<void>;
  onAddPhoto: (files: File[]) => void;
  onCover: (imageId: number) => void;
  onRemovePhoto: (imageId: number) => void;
}) {
  const { tr } = useAppearance();
  const editing = product !== undefined;
  const [categoryId, setCategoryId] = useState(String(product?.category_id ?? categories[0]?.id ?? ""));
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price_amount !== null && product?.price_amount !== undefined ? String(product.price_amount) : "");
  const [stock, setStock] = useState(product?.stock_quantity !== null && product?.stock_quantity !== undefined ? String(product.stock_quantity) : "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [descriptionEn, setDescriptionEn] = useState(product?.description_en ?? "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit() {
    setFormError(null);

    if (!categoryId || !brand.trim() || !name.trim() || price === "" || stock === "") {
      setFormError(tr("Catégorie, marque, nom, prix et stock sont requis."));
      return;
    }

    const problem = photos.map(imageProblem).find(Boolean);
    if (problem) {
      setFormError(problem);
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await onSave({
          category_id: Number(categoryId),
          brand: brand.trim(),
          name: name.trim(),
          price_amount: Number(price),
          stock_quantity: Number(stock),
          name_en: nameEn.trim(),
          description: description.trim(),
          description_en: descriptionEn.trim(),
        });
      } else {
        await onCreate({
          category_id: Number(categoryId),
          brand: brand.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          price_amount: Number(price),
          stock_quantity: Number(stock),
          photos,
          extra: { name_en: nameEn.trim(), description_en: descriptionEn.trim() },
        });
      }
    } catch (caught) {
      setFormError(caught instanceof CatalogError ? caught.message : tr(editing ? "Mise à jour impossible." : "Création impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal
      open
      size="xl"
      title={editing ? `${tr("Modifier le produit")} - ${product.brand} ${product.name}` : tr("Nouveau produit")}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel={editing ? tr("Enregistrer") : tr("Créer")}
      submitting={submitting}
      error={formError ?? externalError}
    >
      <div className="flex flex-col gap-6">
        <section className="grid gap-4 sm:grid-cols-3">
          <label className="field sm:col-span-3">
            <SearchSelect value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={FIELD_CLASS}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SearchSelect>
            <span className="field-label">{tr("Catégorie")}</span>
          </label>
          <label className="field">
            <input placeholder={tr("Marque")} value={brand} onChange={(event) => setBrand(event.target.value)} className={FIELD_CLASS} />
            <span className="field-label">{tr("Marque")}</span>
          </label>
          <label className="field">
            <input
              placeholder="250000"
              type="number"
              min={0}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={FIELD_CLASS}
            />
            <span className="field-label">{tr("Prix (F CFA)")}</span>
          </label>
          <label className="field">
            <input placeholder="25" type="number" min={0} value={stock} onChange={(event) => setStock(event.target.value)} className={FIELD_CLASS} />
            <span className="field-label">{tr("Stock")}</span>
          </label>
        </section>

        <section className="flex flex-col gap-4">
          <h3 className="font-display text-sm font-semibold text-ink">{tr("Textes")}</h3>
          <p className="text-xs text-ink-soft">
            {tr("Le français est la référence. Sans texte anglais, la boutique en anglais affiche le texte français.")}
          </p>
          <LanguageTabs
            enFilled={Boolean(nameEn.trim() || descriptionEn.trim())}
            fr={
              <>
                <label className="field">
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={255}
                    placeholder={tr("Nom du produit")}
                    className={FIELD_CLASS}
                  />
                  <span className="field-label">{tr("Nom du produit")}</span>
                </label>
                <label className="field">
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder={tr("Décrivez le produit en quelques lignes")}
                    className={FIELD_CLASS}
                  />
                  <span className="field-label">{tr("Description")}</span>
                </label>
              </>
            }
            en={
              <>
                <label className="field">
                  <input
                    value={nameEn}
                    onChange={(event) => setNameEn(event.target.value)}
                    maxLength={255}
                    placeholder={tr("Ex. 27-inch monitor")}
                    className={FIELD_CLASS}
                  />
                  <span className="field-label">{tr("Nom du produit")}</span>
                </label>
                <label className="field">
                  <textarea
                    value={descriptionEn}
                    onChange={(event) => setDescriptionEn(event.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder={tr("Describe the product in a few lines")}
                    className={FIELD_CLASS}
                  />
                  <span className="field-label">{tr("Description")}</span>
                </label>
              </>
            }
          />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-display text-sm font-semibold text-ink">{tr("Photos")}</h3>
          {product ? (
            <Gallery product={product} onAdd={onAddPhoto} onCover={onCover} onRemove={onRemovePhoto} />
          ) : (
            <div className="flex flex-col gap-1">
              <Dropzone
                multiple
                maxFiles={MAX_GALLERY_IMAGES}
                accept="image/jpeg,image/png,image/webp"
                label={tr("Photos (optionnelles, plusieurs possibles)")}
                hint={tr("Photos (optionnelles, plusieurs possibles)") + " · " + tr("JPG, PNG, WebP, 2 Mo")}
                selected={photos.map((photo) => photo.name)}
                onFiles={setPhotos}
              />
              {photos.length > 0 ? (
                <span className="text-xs text-ink-soft">
                  {photos.length} {tr("photo(s) choisie(s) - la première sera la couverture.")}
                </span>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </FormModal>
  );
}

function Gallery({
  product,
  onAdd,
  onCover,
  onRemove,
}: {
  product: Product;
  onAdd: (files: File[]) => void;
  onCover: (imageId: number) => void;
  onRemove: (imageId: number) => void;
}) {
  const { tr } = useAppearance();
  const images = product.images ?? [];

  return (
    <div className="flex flex-wrap items-start gap-3">
      {images.map((image, index) => (
        <figure key={image.id} className="flex w-28 flex-col gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.url} alt="" className="h-28 w-28 rounded-sm border border-line object-cover" />
          {index === 0 ? (
            <figcaption className="text-xs font-medium text-gold">{tr("Couverture")}</figcaption>
          ) : (
            <button
              type="button"
              onClick={() => onCover(image.id)}
              className="text-left text-xs text-ink underline-offset-4 hover:text-gold hover:underline"
            >
              <ActionLabel text={tr("Définir comme couverture")} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            className="text-left text-xs text-danger underline-offset-4 hover:underline"
          >
            <ActionLabel text={tr("Supprimer")} />
          </button>
        </figure>
      ))}

      {images.length < MAX_GALLERY_IMAGES ? (
        <Dropzone
          multiple
          maxFiles={MAX_GALLERY_IMAGES - images.length}
          accept="image/jpeg,image/png,image/webp"
          label={tr("+ Ajouter")}
          className="h-28 w-28 !px-1 !py-1 text-xs"
          onFiles={onAdd}
        >
          <span className="text-ink">{tr("+ Ajouter")}</span>
          <span className="px-1 text-[10px]">{tr("Glissez ou cliquez")}</span>
          <span className="px-1 text-[10px]">{tr("JPG, PNG, WebP, 2 Mo")}</span>
        </Dropzone>
      ) : (
        <p className="text-xs text-ink-soft">
          {tr("Galerie pleine (")}
          {MAX_GALLERY_IMAGES} {tr("photos).")}
        </p>
      )}
    </div>
  );
}
