"use client";

import { DataTable } from "@/components/DataTable";
import { useAppearance } from "@/components/AppearanceProvider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackofficeNav } from "@/components/BackofficeNav";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/useAuth";
import { parseOptionalAmount } from "@/lib/input";
import {
  COUPON_STATE_LABEL,
  PromotionsError,
  couponState,
  createCoupon,
  describeDiscount,
  listCoupons,
  setCouponActive,
  usageLabel,
  type Coupon,
  type CouponType,
  type NewCouponInput,
} from "@/lib/promotions";

export default function PromotionsPage() {
  const { tr } = useAppearance();
  const router = useRouter();
  const { status: sessionStatus, token, user, logout } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Evaluated on mount, not during render: the clock must not be frozen by the prerender.
  const [now, setNow] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    listCoupons(token)
      .then((list) => {
        setCoupons(list);
        setNow(new Date());
      })
      .catch((caught) => setError(caught instanceof PromotionsError ? caught.message : tr("Coupons indisponibles.")))
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

  async function handleToggle(coupon: Coupon) {
    if (!token) return;
    setBusyId(coupon.id);
    setError(null);
    try {
      const updated = await setCouponActive(token, coupon.id, !coupon.active);
      setCoupons((current) => current.map((item) => (item.id === coupon.id ? updated : item)));
    } catch (caught) {
      setError(caught instanceof PromotionsError ? caught.message : tr("L'action a échoué."));
    } finally {
      setBusyId(null);
    }
  }

  if (sessionStatus === "checking") {
    return <p className="px-4 py-16 text-center text-sm text-ink-soft">{tr("Vérification de la session…")}</p>;
  }

  if (!token) {
    return (
      <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-3 px-4">
        <p className="text-ink-soft">{tr("Connectez-vous pour accéder aux promotions.")}</p>
        <Link href="/" className="text-sm text-gold underline-offset-4 hover:underline">
          {tr("Se connecter")}
        </Link>
      </main>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <BackofficeNav onLogout={handleLogout} roles={user?.roles} />

      <main className="flex w-full flex-1 flex-col gap-6 px-4 py-8">
        <h1 className="page-title font-display text-2xl font-semibold text-ink">{tr("Promotions")}</h1>

        <NewCouponForm
          onSubmit={async (input) => {
            if (!token) return;
            await createCoupon(token, input);
            refresh();
          }}
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-ink-soft">{tr("Chargement…")}</p>
        ) : coupons.length === 0 ? (
          <p className="text-sm text-ink-soft">{tr("Aucun code promotionnel.")}</p>
        ) : (
          <div className="overflow-x-auto rounded-sm bg-surface p-4 shadow-card border-b-4 border-b-gold">
            <DataTable
  name="promotions"
  rows={coupons}
  headers={[tr("Code"), tr("Remise"), tr("Minimum"), tr("Utilisations"), tr("Validité"), tr("État"), ""]}
  actionColumns={[6]}
  renderRow={(coupon) => (
                  <tr key={coupon.id} className="border-b border-line">
                    <td className="py-3 pr-4 text-ink">{coupon.code}</td>
                    <td className="py-3 pr-4 text-ink">{describeDiscount(coupon)}</td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {coupon.min_order_amount > 0 ? coupon.min_order_amount.toLocaleString("fr-FR") : "-"}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {usageLabel(coupon)}
                      {coupon.max_uses_per_customer ? ` · ${coupon.max_uses_per_customer}/client` : ""}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {coupon.starts_at?.slice(0, 10) ?? "…"} → {coupon.ends_at?.slice(0, 10) ?? "…"}
                    </td>
                    <td className="py-3 pr-4 text-ink-soft">
                      {now ? tr(COUPON_STATE_LABEL[couponState(coupon, now)]) : ""}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        disabled={busyId === coupon.id}
                        onClick={() => handleToggle(coupon)}
                        className="rounded-sm border border-line px-2 py-1 text-xs text-ink transition-colors hover:border-gold disabled:opacity-50"
                      >
                        {coupon.active ? tr("Désactiver") : tr("Réactiver")}
                      </button>
                    </td>
                  </tr>
                )}
/>
          </div>
        )}

        <p className="text-xs text-ink-soft">
          {tr("Les remises sont à la charge de TechniLium : le vendeur est payé et commissionné sur le prix affiché.")}
        </p>
      </main>
    </div>
  );
}

function NewCouponForm({ onSubmit }: { onSubmit: (input: NewCouponInput) => Promise<void> }) {
  const { tr } = useAppearance();
  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percent");
  const [value, setValue] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [perCustomer, setPerCustomer] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const amount = parseOptionalAmount(value);
    const min = parseOptionalAmount(minOrder);
    const max = parseOptionalAmount(maxUses);
    const per = parseOptionalAmount(perCustomer);

    if (!code.trim() || amount === undefined || amount === null) {
      setFormError(tr("Le code et une valeur entière positive sont requis."));
      return;
    }
    if (type === "percent" && amount > 100) {
      setFormError(tr("Un pourcentage ne peut pas dépasser 100."));
      return;
    }
    if (min === null || max === null || per === null) {
      setFormError(tr("Les limites doivent être des entiers positifs (ou vides)."));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        code: code.trim(),
        type,
        value: amount,
        min_order_amount: min,
        max_uses: max,
        max_uses_per_customer: per,
        starts_at: startsAt || undefined,
        ends_at: endsAt || undefined,
      });
      setCode("");
      setValue("");
      setMinOrder("");
      setMaxUses("");
      setPerCustomer("");
      setStartsAt("");
      setEndsAt("");
    } catch (caught) {
      setFormError(caught instanceof PromotionsError ? caught.message : tr("Création impossible."));
    } finally {
      setSubmitting(false);
    }
  }

  const field = "w-32 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-ink";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-sm border border-line p-4 bg-surface shadow-card border-b-4 border-b-gold"
    >
      <label className="field">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={tr("BIENVENUE10")}
          className={`${field} uppercase`}
        />
        <span className="field-label">{tr("Code")}</span>
      </label>
      <label className="field">
        <select value={type} onChange={(e) => setType(e.target.value as CouponType)} className={field}>
          <option value="percent">{tr("Pourcentage")}</option>
          <option value="fixed">{tr("Montant fixe")}</option>
        </select>
        <span className="field-label">{tr("Type")}</span>
      </label>
      <label className="field">
        <input
          placeholder="10"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          className={field}
        />
        <span className="field-label">{type === "percent" ? tr("Valeur (%)") : tr("Valeur (F CFA)")}</span>
      </label>
      <label className="field">
        <input
          placeholder="20000"
          value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)}
          inputMode="numeric"
          className={field}
        />
        <span className="field-label">{tr("Achat minimum")}</span>
      </label>
      <label className="field">
        <input
          placeholder="100"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          inputMode="numeric"
          className={field}
        />
        <span className="field-label">{tr("Utilisations max")}</span>
      </label>
      <label className="field">
        <input
          placeholder="1"
          value={perCustomer}
          onChange={(e) => setPerCustomer(e.target.value)}
          inputMode="numeric"
          className={field}
        />
        <span className="field-label">{tr("Par client")}</span>
      </label>
      <label className="field">
        <input
          placeholder=" "
          type="date"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className={field}
        />
        <span className="field-label">{tr("Début")}</span>
      </label>
      <label className="field">
        <input
          placeholder=" "
          type="date"
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
          className={field}
        />
        <span className="field-label">{tr("Fin")}</span>
      </label>
      <Button type="submit" disabled={submitting}>
        {tr("Créer le code")}
      </Button>
      {formError ? <p className="w-full text-sm text-danger">{formError}</p> : null}
    </form>
  );
}
