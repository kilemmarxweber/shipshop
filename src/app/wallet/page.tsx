"use client";

import Link from "next/link";
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
import type { RailProvider } from "@/lib/payments/provider";
import { CurrencyPicker } from "@/components/currency-picker";
import { usePageBack } from "@/components/back-nav-context";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PROVIDERS: {
  id: RailProvider;
  label: MessagePath;
  color: string;
}[] = [
  { id: "MPESA", label: "wallet.vodacom", color: "from-green-600 to-green-500" },
  { id: "ORANGE", label: "wallet.orange", color: "from-orange-600 to-orange-400" },
  { id: "AIRTEL", label: "wallet.airtel", color: "from-red-600 to-red-400" },
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
  balanceAfterCents?: number | null;
  metadata?: {
    beneficiaryName?: string;
    beneficiaryUserId?: string;
    ussdHint?: string;
  } | null;
};

type Contact = { provider: RailProvider; phone: string };

type Recipient = {
  id: string;
  name: string;
  shopName: string | null;
  phoneMasked: string;
};

export default function WalletPage() {
  const { data: session } = authClient.useSession();
  const { t } = useI18n();
  usePageBack({ fallbackHref: "/profile" });
  const [balance, setBalance] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState<AppCurrency>("USD");
  const [balances, setBalances] = useState({ USD: 0, CDF: 0, KW: 0 });
  const [txns, setTxns] = useState<Txn[]>([]);
  const [contacts, setContacts] = useState<Record<RailProvider, string>>({
    MPESA: "",
    ORANGE: "",
    AIRTEL: "",
  });
  const [tab, setTab] = useState<"me" | "someone">("me");
  const [provider, setProvider] = useState<RailProvider>("MPESA");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ussdHint, setUssdHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);

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
    const next: Record<RailProvider, string> = {
      MPESA: "",
      ORANGE: "",
      AIRTEL: "",
    };
    for (const c of (json.contacts ?? []) as Contact[]) {
      if (c.provider in next) next[c.provider] = c.phone;
    }
    const accountPhone = (json.accountPhone as string | null) ?? "";
    if (accountPhone && !next.MPESA && !next.ORANGE && !next.AIRTEL) {
      next.MPESA = accountPhone;
    }
    setContacts(next);
  }

  useEffect(() => {
    if (!session) return;
    void refresh();
  }, [session]);

  useEffect(() => {
    if (tab !== "someone" || query.trim().length < 2) {
      setRecipients([]);
      return;
    }
    const handle = setTimeout(() => {
      fetch(`/api/wallet/recipients?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((json) => setRecipients(json.recipients ?? []))
        .catch(() => setRecipients([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, tab]);

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

  async function saveContacts() {
    setSavingContacts(true);
    const payload = PROVIDERS.map((p) => ({
      provider: p.id,
      phone: contacts[p.id],
    })).filter((c) => c.phone.trim());
    const { res, data } = await fetchJson<{
      error?: string;
      contacts?: Contact[];
    }>("/api/wallet/contacts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: payload }),
    });
    setSavingContacts(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible d’enregistrer");
      return;
    }
    toast.success("Numéros enregistrés");
    void refresh();
  }

  async function initiate() {
    const raw = contacts[provider];
    const parts = splitPhone(raw);
    const e164 = composePhone(parts.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      toast.error("Enregistrez votre numéro sur ce réseau");
      return;
    }
    if (tab === "someone" && !picked) {
      toast.error("Choisissez un bénéficiaire");
      return;
    }
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error("Montant invalide");
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
        amountCents: cents,
        currency,
        beneficiaryUserId: tab === "someone" ? picked?.id : undefined,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error);
      return;
    }
    setPendingId(json.transactionId);
    setUssdHint(json.ussdHint ?? null);
    toast.message(json.ussdHint ?? t("wallet.ussdHint"));
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
      json.beneficiaryUserId
        ? `${t("wallet.youRecharge")} · ${formatMoney(json.balanceCents, json.currency ?? currency)}`
        : `Compte rechargé · ${formatMoney(json.balanceCents, json.currency ?? currency)}`,
    );
    setPendingId(null);
    setUssdHint(null);
    window.dispatchEvent(new Event("wallet-updated"));
    void refresh();
  }

  function txnLabel(row: Txn) {
    if (row.type === "TRANSFER_IN") return "Reçu";
    if (row.type === "TRANSFER_OUT") {
      return row.metadata?.beneficiaryName
        ? `Pour ${row.metadata.beneficiaryName}`
        : "Envoyé";
    }
    if (row.type === "DEPOSIT") return t("wallet.forYou");
    return row.type;
  }

  function providerName(id: string) {
    if (id === "MPESA") return t("wallet.vodacom");
    if (id === "ORANGE") return t("wallet.orange");
    if (id === "AIRTEL") return t("wallet.airtel");
    return id;
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
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("wallet.payHint")}
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-heading text-sm font-bold">{t("wallet.topUpSimulated")}</h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("me");
              setPicked(null);
            }}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold",
              tab === "me"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface-2",
            )}
          >
            {t("wallet.tabMe")}
          </button>
          <button
            type="button"
            onClick={() => setTab("someone")}
            className={cn(
              "h-10 rounded-xl text-sm font-semibold",
              tab === "someone"
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface-2",
            )}
          >
            {t("wallet.tabSomeone")}
          </button>
        </div>

        {tab === "someone" ? (
          <div className="space-y-2">
            <Label>{t("wallet.searchRecipient")}</Label>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPicked(null);
              }}
              placeholder={t("wallet.searchRecipient")}
              className="h-11 bg-surface-2"
            />
            {picked ? (
              <p className="text-sm">
                {t("wallet.youRecharge")}{" "}
                <span className="font-semibold">
                  {picked.shopName ? `${picked.shopName} · ` : ""}
                  {picked.name}
                </span>
              </p>
            ) : (
              <ul className="space-y-1">
                {recipients.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setPicked(r)}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm"
                    >
                      <span className="font-medium">{r.name}</span>
                      {r.shopName ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {r.shopName}
                        </span>
                      ) : null}
                      <span className="block text-[11px] text-muted-foreground">
                        {r.phoneMasked}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProvider(p.id)}
              className={cn(
                "rounded-2xl bg-gradient-to-br p-3 text-center text-[11px] font-bold leading-tight",
                p.color,
                provider === p.id &&
                  "ring-2 ring-white ring-offset-2 ring-offset-background",
              )}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">{t("wallet.emoneyPhone")}</p>
        <PhoneField
          id="wallet-phone"
          label={t(PROVIDERS.find((p) => p.id === provider)!.label)}
          value={contacts[provider]}
          onChange={(v) =>
            setContacts((prev) => ({ ...prev, [provider]: v }))
          }
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
            {loading ? "…" : t("wallet.sendPay")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm">{ussdHint ?? t("wallet.ussdHint")}</p>
            <Button
              onClick={confirm}
              disabled={loading}
              className="h-12 w-full bg-gradient-to-r from-trust to-[#00b377] font-bold"
            >
              {loading ? "…" : t("wallet.confirmPay")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="font-heading text-sm font-bold">{t("wallet.myNumbers")}</h2>
        {PROVIDERS.map((p) => (
          <PhoneField
            key={p.id}
            id={`contact-${p.id}`}
            label={t(p.label)}
            value={contacts[p.id]}
            onChange={(v) =>
              setContacts((prev) => ({ ...prev, [p.id]: v }))
            }
          />
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={savingContacts}
          onClick={() => void saveContacts()}
          className="w-full"
        >
          {savingContacts ? "…" : t("wallet.saveNumbers")}
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 font-heading text-sm font-bold">{t("wallet.history")}</h2>
        <ul className="space-y-2">
          {txns.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {txnLabel(row)} · {providerName(row.provider)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {row.status} · {new Date(row.createdAt).toLocaleString("fr-FR")}
                  {row.balanceAfterCents != null
                    ? ` · ${formatMoney(row.balanceAfterCents, row.currency)}`
                    : ""}
                </p>
              </div>
              <span
                className={cn(
                  "font-heading font-bold",
                  row.type === "PURCHASE"
                    ? "text-destructive"
                    : row.type === "TRANSFER_OUT"
                      ? "text-foreground"
                      : "text-trust",
                )}
              >
                {row.type === "PURCHASE"
                  ? "−"
                  : row.type === "TRANSFER_OUT"
                    ? ""
                    : "+"}
                {formatMoney(Math.abs(row.amountCents), row.currency)}
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
