import {
  Archive,
  ArchiveRestore,
  Ban,
  Banknote,
  Calculator,
  Check,
  Database,
  History,
  Minus,
  Download,
  Eye,
  FileText,
  Filter,
  LogIn,
  Lock,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  TriangleAlert,
  Undo2,
  Upload,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";

/**
 * The icon of an action, from its (French or English) label. The first matching
 * rule wins, so the specific labels ("Annuler la vente") come before the general
 * ones ("Annuler"). A label with no rule gets no icon.
 */
const RULES: [RegExp, LucideIcon][] = [
  [/^(annuler la vente|cancel (the )?sale)/i, Ban],
  [/^(annuler|cancel|fermer|close|rejeter|reject|retirer|remove|refuser|decline)/i, X],
  [/^(d[ée]sactiv|deactivat|disable|suspendre|suspend)/i, PowerOff],
  [/^(r[ée]activ|activer|activate|reactivat|enable)/i, Power],
  [/^(supprimer|delete)/i, Trash2],
  [/^(archiver|archive)/i, Archive],
  [/^(restaurer|restore)/i, ArchiveRestore],
  [/^(r[ée]tablir|reinstate|rembourser|refund)/i, Undo2],
  [/^(modifier|edit|g[ée]rer|manage)/i, Pencil],
  [/^(d[ée]tails?)/i, Eye],
  [/^(nouveau|nouvelle|new |ajouter|add|cr[ée]er|create|augmenter|increase)/i, Plus],
  [/^(diminuer|decrease|reduce)/i, Minus],
  [/^(historique|history)/i, History],
  [/^(enregistrer|save)/i, Save],
  [/^(importer|import)/i, Upload],
  [/^(ticket|imprimer|print)/i, Printer],
  [/^(re[cç]u|receipt)/i, Receipt],
  [/^(rapport pdf|pdf|relev[ée]|statement|exporter|export|t[ée]l[ée]charger|download|png|svg)/i, Download],
  [/^([ée]mettre|issue)/i, FileText],
  [/^(approuver|approve|confirmer|confirm|publier|publish|appliquer|apply|valider|validate)/i, Check],
  [/^(envoyer|send|r[ée]pondre|reply|ajouter la note|add (the )?note)/i, Send],
  [/^(r[ée]gler|pay|encaisser|collect|marquer pay[ée]|mark (as )?paid)/i, Banknote],
  [/^(assigner|assign)/i, UserPlus],
  [/^(relancer|retry|r[ée]essayer|actualiser|refresh)/i, RefreshCw],
  [/^(filtrer|filter)/i, Filter],
  [/^(rechercher|search)/i, Search],
  [/^(calculer|calculate)/i, Calculator],
  [/^(cl[ôo]turer|close the till|close till)/i, Lock],
  [/^(marquer exp[ée]di[ée]|mark (as )?shipped|exp[ée]dier|ship)/i, Truck],
  [/^(marquer [ée]chou[ée]|[ée]chec|mark (as )?failed|failed)/i, TriangleAlert],
  [/^(v[ée]rifier|verify)/i, ShieldCheck],
  [/^(donn[ée]es|data)/i, Database],
  [/^(r[ée]initialiser|reset)/i, RotateCcw],
  [/^(d[ée]finir comme couverture|set as cover)/i, Star],
  [/^(se connecter|sign in|log in)/i, LogIn],
];

export function actionIcon(label: string): LucideIcon | null {
  const text = label.trim();
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/** A button's text with the icon of its action in front of it. */
export function ActionLabel({ text }: { text: string }) {
  const icon = actionIcon(text);
  if (!icon) return <>{text}</>;

  return (
    <span className="inline-flex items-center gap-1.5">
      {createElement(icon, { className: "h-3.5 w-3.5 shrink-0", "aria-hidden": true })}
      {text}
    </span>
  );
}
