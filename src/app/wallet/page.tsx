"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import {
  composePhone,
  isValidContactPhone,
  splitPhone,
} from "@/lib/phone";
import { formatMoney, cn } from "@/lib/utils";
import {
  APP_CURRENCIES,
  type AppCurrency,
  parseCurrency,
  walletCents,
} from "@/lib/money";
import { CurrencyPicker } from "@/components/currency-picker";
import { usePageBack } from "@/components/back-nav-context";
import { useI18n } from "@/components/i18n-provider";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PROVIDERS = [
  { id: "MPESA" as const, label: "M-Pesa", color: "from-green-600 to-green-500" },
  { id: "ORANGE" as const, label: "Orange Money", color: "from-orange-600 to-orange-400" },
  { id: "AIRTEL" as const, label: "Airtel Money", color: "from-red-600 to-red-400" },
];

type Txn = {
  id: string;
  type: string;
  amountCents: number;
  currency?: string;
  status: string;
  provider: string;
  phone: string | null;
  reference: string | null;
  createdAt: string;
};

export default function WalletPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  usePageBack({ fallbackHref: "/profile" });
  const [balance, setBalance] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState<AppCurrency>("USD");
  const [balances, setBalances] = useState({ USD: 0, CDF: 0, KW: 0 });
  const [txns, setTxns] = useState<Txn[]>([]);
  const [provider, setProvider] = useState<"MPESA" | "ORANGE" | "AIRTEL">("MPESA");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/wallet");
    if (!res.ok) return;
    const json = await res.json();
    const wallet = json.wallet ?? {};
    const code = parseCurrency(wallet.currency);
    setDisplayCurrency(code);
    setBalances({
      USD: walletCents(wallet, "USD"),
      CDF: walletCents(wallet, "CDF"),
      KW: walletCents(wallet, "KW"),
    });
    setBalance(walletCents(wallet, code));
    setTxns(json.transactions ?? []);
  }

  useEffect(() => {
    if (!session) return;
    void refresh();
    fetchJson<{ user?: { phone?: string | null } }>("/api/profile")
      .then(({ data }) => {
        const saved = data?.user?.phone ?? "";
        if (saved) {
          setPhone((prev) => prev || saved);
        }
      })
      .catch(() => undefined);
  }, [session]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">{t("wallet.guestHint")}</p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          {t("auth.login")}
        </Link>
      </div>
    );
  }

  async function initiate() {
    const parts = splitPhone(phone);
    const e164 = composePhone(parts.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      toast.error("Indiquez un numéro e-money avec l’indicatif pays");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "initiate",
        provider,
        phone: e164,
        amountCents: Math.round(parseFloat(amount) * 100),
        currency,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error);
      return;
    }
    setPendingId(json.transactionId);
    toast.message("Demande USSD simulée — confirmez le paiement");
  }

  async function confirm() {
    if (!pendingId) return;
    setLoading(true);
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", transactionId: pendingId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error);
      return;
    }
    toast.success(
      `Compte rechargé · ${formatMoney(json.balanceCents, json.currency ?? currency)}`,
    );
    setPendingId(null);
    router.push("/discover");
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-0">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-[#13131a] to-[#1c1c26] p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          {t("wallet.title")}
        </div>
        <p className="mt-2 font-heading text-4xl font-extrabold text-trust">
          {formatMoney(balance, displayCurrency)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {APP_CURRENCIES.map((code) => (
            <span
              key={code}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/80"
            >
              {formatMoney(balances[code], code)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Rechargez via Mobile Money avant d&apos;acheter
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-heading text-sm font-bold">{t("wallet.topUpSimulated")}</h2>
        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={cn(
                "rounded-2xl bg-gradient-to-br p-3 text-center text-xs font-bold",
                p.color,
                provider === p.id && "ring-2 ring-white ring-offset-2 ring-offset-background",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <PhoneField
          id="wallet-phone"
          label="Numéro e-money"
          value={phone}
          onChange={setPhone}
        />
        <div className="space-y-2">
          <Label>{t("wallet.currency")}</Label>
          <CurrencyPicker value={currency} onChange={setCurrency} />
        </div>
        <div className="space-y-2">
          <Label>
            {t("wallet.amount")} ({currency})
          </Label>
          <Input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 bg-surface-2 font-heading text-lg font-bold"
          />
        </div>

        {!pendingId ? (
          <Button
            onClick={initiate}
            disabled={loading}
            className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] font-bold"
          >
            {loading ? "Envoi…" : "Demander le paiement"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm">
              Composez le code USSD sur votre téléphone (simulé), puis confirmez.
            </p>
            <Button
              onClick={confirm}
              disabled={loading}
              className="h-12 w-full bg-gradient-to-r from-trust to-[#00b377] font-bold"
            >
              {loading ? "Confirmation…" : "Confirmer le dépôt"}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-heading text-sm font-bold">{t("wallet.history")}</h2>
        <ul className="space-y-2">
          {txns.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t.type} · {t.provider}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.status} · {new Date(t.createdAt).toLocaleString("fr-FR")}
                </p>
              </div>
              <span
                className={cn(
                  "font-heading font-bold",
                  t.amountCents >= 0 ? "text-trust" : "text-destructive",
                )}
              >
                {t.amountCents >= 0 ? "+" : ""}
                {formatMoney(Math.abs(t.amountCents), t.currency)}
              </span>
            </li>
          ))}
          {txns.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("wallet.emptyHistory")}
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
