"use client";

import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { CatalogError, createProduct, type Category } from "@/lib/catalog";
import { IMPORT_COLUMNS, IMPORT_EXTENSIONS, mapProducts, readImportFile, type ImportRow } from "@/lib/productImport";
import { downloadImportTemplate, type TemplateFormat } from "@/lib/productImportTemplates";
import { ActionLabel } from "./ActionLabel";
import { useAppearance } from "./AppearanceProvider";
import { Button } from "./Button";
import { Modal } from "./Modal";

type Phase = "pick" | "preview" | "importing" | "done";

interface Failure {
  line: number;
  label: string;
  reason: string;
}

const PREVIEW_ROWS = 100;

/**
 * Bulk product import from an Excel, CSV or SQL file: pick the file, check what
 * will be imported (rows with a problem are listed and skipped), then create the
 * products one by one with the regular product API.
 */
export function ProductImportModal({
  open,
  token,
  categories,
  onClose,
  onImported,
}: {
  open: boolean;
  token: string;
  categories: Category[];
  onClose: () => void;
  /** Called once with how many products were created, when the dialog is closed after an import. */
  onImported: () => void;
}) {
  const { tr } = useAppearance();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);

  const valid = rows.filter((row) => row.input !== null);
  const invalid = rows.filter((row) => row.error !== null);

  function reset() {
    setPhase("pick");
    setFileName("");
    setRows([]);
    setError(null);
    setProgress(0);
    setCreated(0);
    setFailures([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close() {
    if (phase === "importing") return;
    if (created > 0) onImported();
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!IMPORT_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
      setError(tr("Format non pris en charge : utilisez un fichier Excel (.xlsx), CSV ou SQL."));
      return;
    }

    try {
      const table = await readImportFile(file);
      const mapped = mapProducts(table, categories);
      if (mapped.length === 0) {
        setError(tr("Le fichier ne contient aucune ligne de produit."));
        return;
      }
      setFileName(file.name);
      setRows(mapped);
      setPhase("preview");
    } catch {
      setError(tr("Impossible de lire ce fichier."));
    }
  }

  async function runImport() {
    setPhase("importing");
    setProgress(0);
    setCreated(0);
    const problems: Failure[] = invalid.map((row) => ({ line: row.line, label: row.label, reason: tr(row.error ?? "") }));
    let done = 0;

    for (const row of valid) {
      try {
        await createProduct(token, row.input!);
        done += 1;
        setCreated(done);
      } catch (caught) {
        const reason = caught instanceof CatalogError ? (Object.values(caught.fieldErrors ?? {})[0]?.[0] ?? caught.message) : tr("Création impossible.");
        problems.push({ line: row.line, label: row.label, reason });
      }
      setProgress((current) => current + 1);
    }

    setFailures(problems.sort((a, b) => a.line - b.line));
    setPhase("done");
  }

  const footer =
    phase === "pick" ? (
      <Button type="button" variant="secondary" onClick={close}>
        <ActionLabel text={tr("Fermer")} />
      </Button>
    ) : phase === "preview" ? (
      <>
        <Button type="button" variant="secondary" onClick={reset}>
          {tr("Changer de fichier")}
        </Button>
        <Button type="button" disabled={valid.length === 0} onClick={runImport}>
          <FileUp className="mr-1.5 h-4 w-4" aria-hidden />
          {`${tr("Importer")} ${valid.length} ${valid.length > 1 ? tr("produits") : tr("produit")}`}
        </Button>
      </>
    ) : phase === "done" ? (
      <Button type="button" onClick={close}>
        <ActionLabel text={tr("Fermer")} />
      </Button>
    ) : null;

  return (
    <Modal open={open} title={tr("Importer des produits")} onClose={close} size="lg" footer={footer}>
      <div className="grid gap-4 text-sm">
        {phase === "pick" ? (
          <>
            <p className="text-ink-soft">
              {tr("Importez plusieurs produits d'un coup depuis un fichier Excel (.xlsx), CSV ou SQL (instructions INSERT). La première ligne d'un fichier Excel ou CSV doit contenir les noms des colonnes.")}
            </p>

            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-sm border border-dashed border-line px-4 py-6 text-center transition-colors hover:border-gold">
              <FileUp className="h-6 w-6 text-gold" aria-hidden />
              <span className="font-medium text-ink">{tr("Choisir un fichier")}</span>
              <span className="text-xs text-ink-soft">.xlsx, .csv, .sql</span>
              <input ref={inputRef} type="file" accept={IMPORT_EXTENSIONS.join(",")} className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>

            {error ? (
              <p role="alert" className="text-danger">
                {error}
              </p>
            ) : null}

            <section className="grid gap-2">
              <h3 className="font-medium text-ink">{tr("Structure du fichier")}</h3>
              <div className="overflow-x-auto rounded-sm border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised text-ink-soft">
                    <tr>
                      <th className="px-2 py-1.5 font-medium">{tr("Colonne")}</th>
                      <th className="px-2 py-1.5 font-medium">{tr("Obligatoire")}</th>
                      <th className="px-2 py-1.5 font-medium">{tr("Contenu attendu")}</th>
                      <th className="px-2 py-1.5 font-medium">{tr("Exemple")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IMPORT_COLUMNS.map((column) => (
                      <tr key={column.name} className="border-t border-line align-top">
                        <td className="px-2 py-1.5 font-mono text-ink">{column.name}</td>
                        <td className={`px-2 py-1.5 ${column.required ? "font-medium text-ink" : "text-ink-soft"}`}>{column.required ? tr("Oui") : tr("Non")}</td>
                        <td className="px-2 py-1.5 text-ink-soft">{tr(column.help)}</td>
                        <td className="px-2 py-1.5 text-ink-soft">{column.example[0]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-soft">{tr("Les noms de colonnes français ou anglais sont reconnus (prix ou price, marque ou brand…), sans tenir compte des accents ni de la casse. Un fichier SQL peut utiliser n'importe quel nom de table.")}</p>
            </section>

            <section className="grid gap-2">
              <h3 className="font-medium text-ink">{tr("Télécharger un modèle")}</h3>
              <div className="flex flex-wrap gap-2">
                {(["xlsx", "csv", "sql"] as TemplateFormat[]).map((format) => (
                  <Button key={format} type="button" variant="secondary" onClick={() => void downloadImportTemplate(format)}>
                    <Download className="mr-1.5 h-4 w-4" aria-hidden />
                    {format === "xlsx" ? "Excel (.xlsx)" : format === "csv" ? "CSV (.csv)" : "SQL (.sql)"}
                  </Button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {phase === "preview" ? (
          <>
            <p className="text-ink">
              <span className="font-medium">{fileName}</span> - {valid.length} {tr("prêt(s) à importer")}
              {invalid.length > 0 ? <span className="text-danger">, {invalid.length} {tr("avec une erreur (ignorés)")}</span> : null}
            </p>
            <div className="max-h-72 overflow-auto rounded-sm border border-line">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface-raised text-ink-soft">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">{tr("Ligne")}</th>
                    <th className="px-2 py-1.5 font-medium">{tr("Produit")}</th>
                    <th className="px-2 py-1.5 font-medium">{tr("Prix")}</th>
                    <th className="px-2 py-1.5 font-medium">{tr("Stock")}</th>
                    <th className="px-2 py-1.5 font-medium">{tr("Statut")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((row) => (
                    <tr key={row.line} className="border-t border-line">
                      <td className="px-2 py-1.5 text-ink-soft">{row.line}</td>
                      <td className="px-2 py-1.5 text-ink">{row.label}</td>
                      <td className="px-2 py-1.5 text-ink">{row.input ? row.input.price_amount.toLocaleString("fr-FR") : "-"}</td>
                      <td className="px-2 py-1.5 text-ink">{row.input ? row.input.stock_quantity : "-"}</td>
                      <td className={`px-2 py-1.5 ${row.error ? "text-danger" : "text-ink-soft"}`}>{row.error ? tr(row.error) : "OK"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > PREVIEW_ROWS ? <p className="text-xs text-ink-soft">{`${tr("Aperçu des")} ${PREVIEW_ROWS} ${tr("premières lignes sur")} ${rows.length}.`}</p> : null}
          </>
        ) : null}

        {phase === "importing" ? (
          <div className="grid gap-2" role="status" aria-live="polite">
            <p className="text-ink">
              {tr("Import en cours…")} {progress} / {valid.length}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-gold transition-all" style={{ width: `${valid.length === 0 ? 0 : (progress / valid.length) * 100}%` }} />
            </div>
          </div>
        ) : null}

        {phase === "done" ? (
          <>
            <p className="font-medium text-ink">
              {created} {created > 1 ? tr("produits créés") : tr("produit créé")}
              {failures.length > 0 ? <span className="text-danger">, {failures.length} {tr("non importé(s)")}</span> : null}
            </p>
            {failures.length > 0 ? (
              <ul className="max-h-60 overflow-auto rounded-sm border border-line text-xs">
                {failures.map((failure) => (
                  <li key={`${failure.line}-${failure.reason}`} className="flex gap-2 border-b border-line px-2 py-1.5 last:border-b-0">
                    <span className="w-12 shrink-0 text-ink-soft">{tr("Ligne")} {failure.line}</span>
                    <span className="min-w-0 flex-1 text-ink">{failure.label}</span>
                    <span className="text-danger">{failure.reason}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
