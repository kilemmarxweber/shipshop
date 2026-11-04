"use client";

import { usePageBack } from "@/components/back-nav-context";
import { CurrencyPicker } from "@/components/currency-picker";
import { useI18n, type MessagePath } from "@/components/i18n-provider";
import { PageLoader } from "@/components/page-loader";
import { PhoneField } from "@/components/phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import {
    APP_CURRENCIES,
    parseCurrency,
    walletCents,
    type AppCurrency,
} from "@/lib/money";
import {
    clearPaymentIdempotencyKey,
    fetchPaymentJson,
    paymentIdempotencyKey,
} from "@/lib/payments/idempotency-client";
import type { RailProvider } from "@/lib/payments/provider";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { cn, formatMoney } from "@/lib/utils";
import { notifyWalletUpdated, WALLET_UPDATED_EVENT } from "@/lib/wallet-events";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PROVIDERS: {
  id: RailProvider;
  label: MessagePath;
  color: string;
}[] = [
  {
    id: "MPESA",
    label: "wallet.vodacom",
    color: "from-green-600 to-green-500",
  },
  {
    id: "ORANGE",
    label: "wallet.orange",
    color: "from-orange-600 to-orange-400",
  },
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
  const { data: session, isPending } = authClient.useSession();
  const { t } = useI18n();
  usePageBack({ fallbackHref: "/profile" });
  const [balance, setBalance] = useState(0);
  const [displayCurrency, setDisplayCurrency] = useState<AppCurrency>("USD");
  const [balances, setBalances] = useState({ USD: 0, CDF: 0, KW: 0 });
  const [pots, setPots] = useState({
    BUYER: 0,
    VENDOR: 0,
    COURIER: 0,
  });
  const [withdrawBucket, setWithdrawBucket] = useState<
    "BUYER" | "VENDOR" | "COURIER"
  >("BUYER");
  const [withdrawing, setWithdrawing] = useState(false);
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutProvider, setPayoutProvider] = useState<RailProvider>("MPESA");
  const [payoutEdited, setPayoutEdited] = useState(false);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [contacts, setContacts] = useState<Record<RailProvider, string>>({
    MPESA: "",
    ORANGE: "",
    AIRTEL: "",
  });
  const [tab, setTab] = useState<"me" | "someone">("me");
  const [provider, setProvider] = useState<RailProvider | null>("MPESA");
  const [amount, setAmount] = useState("50");
  const [currency, setCurrency] = useState<AppCurrency>("USD");
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [picked, setPicked] = useState<Recipient | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingMovementId, setPendingMovementId] = useState<string | null>(
    null,
  );
  const [ussdHint, setUssdHint] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingContacts, setSavingContacts] = useState(false);
  const [checking, setChecking] = useState(false);

  const payIntent = useMemo(
    () =>
      [tab, amount, currency, provider ?? "BAL", picked?.id ?? ""].join("|"),
    [tab, amount, currency, provider, picked?.id],
  );

  async function refresh() {
    const res = await fetch("/api/wallet", { cache: "no-store" });
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
    const potRow = json.pots?.[code] ?? json.pots?.USD;
    if (potRow) {
      setPots({
        BUYER: potRow.BUYER ?? 0,
        VENDOR: potRow.VENDOR ?? 0,
        COURIER: potRow.COURIER ?? 0,
      });
    }
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
    if (isPending || !session) return;
    void refresh();
  }, [session, isPending]);

  useEffect(() => {
    if (payoutEdited) return;
    setPayoutPhone(contacts[payoutProvider] || "");
  }, [contacts, payoutProvider, payoutEdited]);

  useEffect(() => {
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener(WALLET_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(WALLET_UPDATED_EVENT, onUpdate);
  }, []);

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

  if (isPending) {
    return <PageLoader />;
  }

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
    await refresh();
  }

  async function resetAfterSend() {
    clearPaymentIdempotencyKey(payIntent);
    setPendingId(null);
    setPendingMovementId(null);
    setUssdHint(null);
    setPicked(null);
    setQuery("");
    setRecipients([]);
    setAmount("50");
    notifyWalletUpdated();
    await refresh();
  }

  type PayResult = {
    error?: string;
    transactionId?: string | null;
    movementId?: string;
    status?: string;
    ussdHint?: string | null;
    paymentUrl?: string | null;
    alreadyApplied?: boolean;
    alreadyConfirmed?: boolean;
    beneficiaryUserId?: string | null;
    balanceCents?: number;
    payerBalanceAfter?: number;
    currency?: string;
  };

  function paintOwnBalance(json: PayResult) {
    const code = parseCurrency(json.currency ?? currency);
    const own =
      typeof json.payerBalanceAfter === "number"
        ? json.payerBalanceAfter
        : json.beneficiaryUserId
          ? undefined
          : json.balanceCents;
    if (typeof own !== "number") return;
    setBalances((prev) => ({ ...prev, [code]: own }));
    setBalance((prev) => (code === displayCurrency ? own : prev));
  }

  async function applyPayResult(json: PayResult, mode: "initiate" | "done") {
    if (json.status === "EXPIRED" || json.status === "REJECTED") {
      toast.error(t("wallet.expiredPay"));
      await resetAfterSend();
      return;
    }
    if (mode === "initiate" && json.paymentUrl) {
      setPaymentUrl(json.paymentUrl);
      setPendingId(json.transactionId ?? null);
      setPendingMovementId(json.movementId ?? null);
      window.location.assign(json.paymentUrl);
      return;
    }
    if (mode === "initiate" && json.status && json.status !== "POSTED") {
      setPendingId(json.transactionId ?? null);
      setPendingMovementId(json.movementId ?? null);
      setUssdHint(json.ussdHint ?? null);
      toast.message(json.ussdHint?.trim() || t("wallet.ussdHint"));
      return;
    }
    if (
      json.status === "POSTED" ||
      json.alreadyApplied ||
      json.alreadyConfirmed
    ) {
      paintOwnBalance(json);
      const shown = json.payerBalanceAfter ?? json.balanceCents ?? 0;
      toast.success(
        json.beneficiaryUserId
          ? `${t("wallet.youRecharge")} · ${formatMoney(shown, json.currency ?? currency)}`
          : tab === "someone" && !provider
            ? `${t("wallet.transferOk")} · ${formatMoney(shown, json.currency ?? currency)}`
            : `Compte rechargé · ${formatMoney(shown, json.currency ?? currency)}`,
      );
      await resetAfterSend();
    }
  }

  async function lookupPending(): Promise<PayResult | null> {
    const qs = pendingMovementId
      ? `id=${encodeURIComponent(pendingMovementId)}`
      : `idempotencyKey=${encodeURIComponent(paymentIdempotencyKey(payIntent))}`;
    const res = await fetch(`/api/wallet/movements?${qs}`);
    if (res.status === 404) return null;
    const json = await res.json();
    return (json.movement ?? json) as PayResult;
  }

  async function initiate() {
    if (tab === "someone" && !picked) {
      toast.error("Choisissez un bénéficiaire");
      return;
    }
    const cents = Math.round(parseFloat(amount) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error("Montant invalide");
      return;
    }
    const key = paymentIdempotencyKey(payIntent);

    if (tab === "someone" && !provider) {
      setLoading(true);
      try {
        const { res, data } = await fetchPaymentJson<PayResult>(
          "/api/wallet/transfer",
          {
            method: "POST",
            idempotencyKey: key,
            body: JSON.stringify({
              amountCents: cents,
              currency,
              beneficiaryUserId: picked?.id,
              idempotencyKey: key,
            }),
          },
        );
        setLoading(false);
        if (!res.ok) {
          toast.error(data.error ?? "Transfert impossible");
          return;
        }
        await applyPayResult(
          { ...data, status: data.status ?? "POSTED" },
          "done",
        );
      } catch (error) {
        setLoading(false);
        toast.message(t("wallet.connectionLost"));
        const found = await lookupPending();
        if (found) await applyPayResult(found, "done");
        else toast.error(error instanceof Error ? error.message : "Erreur");
      }
      return;
    }

    if (!provider) {
      toast.error("Choisissez un réseau");
      return;
    }
    const raw = contacts[provider];
    const parts = splitPhone(raw);
    const e164 = composePhone(parts.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      toast.error("Enregistrez votre numéro sur ce réseau");
      return;
    }
    setLoading(true);
    try {
      const { res, data } = await fetchPaymentJson<PayResult>(
        "/api/wallet/deposit",
        {
          method: "POST",
          idempotencyKey: key,
          body: JSON.stringify({
            action: "initiate",
            provider,
            phone: e164,
            amountCents: cents,
            currency,
            beneficiaryUserId: tab === "someone" ? picked?.id : undefined,
            idempotencyKey: key,
          }),
        },
      );
      setLoading(false);
      if (!res.ok) {
        clearPaymentIdempotencyKey(payIntent);
        toast.error(data.error ?? "Demande impossible");
        return;
      }
      await applyPayResult(data, "initiate");
    } catch (error) {
      setLoading(false);
      toast.message(t("wallet.connectionLost"));
      const found = await lookupPending();
      if (found) await applyPayResult(found, "initiate");
      else toast.error(error instanceof Error ? error.message : "Erreur");
    }
  }

  async function confirm() {
    if (!pendingId && !pendingMovementId) return;
    setLoading(true);
    try {
      const found = await lookupPending();
      if (found?.status === "POSTED") {
        setLoading(false);
        await applyPayResult(found, "done");
        return;
      }
      if (found?.status === "EXPIRED" || found?.status === "REJECTED") {
        setLoading(false);
        await applyPayResult(found, "done");
        return;
      }
      const txnId = pendingId ?? found?.transactionId;
      if (!txnId) {
        setLoading(false);
        toast.error("Paiement introuvable");
        return;
      }
      const { res, data } = await fetchPaymentJson<PayResult>(
        "/api/wallet/deposit",
        {
          method: "POST",
          idempotencyKey: paymentIdempotencyKey(payIntent),
          body: JSON.stringify({ action: "confirm", transactionId: txnId }),
        },
      );
      setLoading(false);
      if (!res.ok) {
        toast.error(data.error ?? "Confirmation impossible");
        return;
      }
      await applyPayResult(data, "done");
    } catch {
      setLoading(false);
      toast.message(t("wallet.connectionLost"));
      const found = await lookupPending();
      if (found)
        await applyPayResult(
          found,
          found.status === "POSTED" ? "done" : "initiate",
        );
    }
  }

  async function verifyState() {
    setChecking(true);
    try {
      const found = await lookupPending();
      if (!found) {
        toast.error("Aucun mouvement à vérifier");
        return;
      }
      await applyPayResult(
        found,
        found.status === "POSTED" ? "done" : "initiate",
      );
    } finally {
      setChecking(false);
    }
  }

  function txnLabel(row: Txn) {
    if (row.type === "REFUND") return t("wallet.txnRefund");
    if (row.type === "PURCHASE") return t("wallet.txnPurchase");
    if (row.type === "ADJUSTMENT") return t("wallet.txnAdjustment");
    if (row.type === "TRANSFER_IN") return t("wallet.txnReceived");
    if (row.type === "TRANSFER_OUT") {
      return row.metadata?.beneficiaryName
        ? `Pour ${row.metadata.beneficiaryName}`
        : t("wallet.txnSent");
    }
    if (row.type === "DEPOSIT") return t("wallet.forYou");
    if (row.type === "WITHDRAWAL") {
      const bucket = (row.metadata as { bucket?: string } | null)?.bucket;
      const pot =
        bucket === "VENDOR"
          ? "ventes"
          : bucket === "COURIER"
            ? "courses"
            : bucket === "BUYER"
              ? "à dépenser"
              : "";
      const dest = row.phone?.trim();
      const where = dest ? ` vers ${dest}` : "";
      return pot ? `Retrait ${pot}${where}` : `Retrait${where}`;
    }
    if (row.type === "ESCROW_RELEASE") return "Vente encaissée";
    return row.type;
  }

  function txnOutgoing(row: Txn) {
    if (row.amountCents < 0) return true;
    return (
      row.type === "PURCHASE" ||
      row.type === "TRANSFER_OUT" ||
      row.type === "WITHDRAWAL" ||
      row.type === "PLATFORM_FEE" ||
      row.type === "SHIPCASH_CLAWBACK" ||
      row.type === "COURIER_PAYOUT"
    );
  }

  function providerName(id: string) {
    if (id === "MPESA") return t("wallet.vodacom");
    if (id === "ORANGE") return t("wallet.orange");
    if (id === "AIRTEL") return t("wallet.airtel");
    if (id === "INTERNAL") return t("wallet.fromBalance");
    return id;
  }

  const payFromBalance = tab === "someone" && !provider;

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-0">
      <div className="rounded-3xl border border-border bg-card p-6">
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
              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground"
            >
              {formatMoney(balances[code], code)}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t("wallet.payHint")}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
          <button
            type="button"
            onClick={() => setWithdrawBucket("BUYER")}
            className={cn(
              "rounded-xl border px-1 py-2",
              withdrawBucket === "BUYER"
                ? "border-trust bg-trust/10"
                : "border-border",
            )}
          >
            <p className="text-muted-foreground">À dépenser</p>
            <p className="font-bold">
              {formatMoney(pots.BUYER, displayCurrency)}
            </p>
            <p className="text-[10px] text-amber-300">retrait 5 %</p>
          </button>
          <button
            type="button"
            onClick={() => setWithdrawBucket("VENDOR")}
            className={cn(
              "rounded-xl border px-1 py-2",
              withdrawBucket === "VENDOR"
                ? "border-trust bg-trust/10"
                : "border-border",
            )}
          >
            <p className="text-muted-foreground">Ventes</p>
            <p className="font-bold">
              {formatMoney(pots.VENDOR, displayCurrency)}
            </p>
            <p className="text-[10px] text-trust">retrait 0 %</p>
          </button>
          <button
            type="button"
            onClick={() => setWithdrawBucket("COURIER")}
            className={cn(
              "rounded-xl border px-1 py-2",
              withdrawBucket === "COURIER"
                ? "border-trust bg-trust/10"
                : "border-border",
            )}
          >
            <p className="text-muted-foreground">Courses</p>
            <p className="font-bold">
              {formatMoney(pots.COURIER, displayCurrency)}
            </p>
            <p className="text-[10px] text-amber-300">retrait 5 %</p>
          </button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPayoutProvider(p.id);
                setPayoutEdited(false);
              }}
              className={cn(
                "rounded-xl bg-gradient-to-br px-2 py-2 text-center text-[11px] font-bold",
                p.color,
                payoutProvider === p.id && "ring-2 ring-white",
              )}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <PhoneField
            id="payout-phone"
            label="Numéro qui reçoit le retrait"
            value={payoutPhone}
            onChange={(value) => {
              setPayoutEdited(true);
              setPayoutPhone(value);
            }}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            CinetPay envoie la sortie sur le numéro enregistré. Vous pouvez en
            saisir un autre.
          </p>
        </div>
        <Button
          className="mt-3 w-full"
          disabled={withdrawing || pots[withdrawBucket] <= 0}
          onClick={async () => {
            const phone = payoutPhone.trim();
            if (!isValidContactPhone(phone)) {
              toast.error("Saisissez le numéro qui reçoit le retrait");
              return;
            }
            setWithdrawing(true);
            const feePct = withdrawBucket === "VENDOR" ? 0 : 5;
            const gross = pots[withdrawBucket];
            const fee = Math.floor((gross * feePct) / 100);
            const intent = `withdraw:${withdrawBucket}:${gross}:${displayCurrency}`;
            const idempotencyKey = paymentIdempotencyKey(intent);
            try {
              const { res, data } = await fetchPaymentJson<{ error?: string }>(
                "/api/wallet/withdraw",
                {
                  method: "POST",
                  idempotencyKey,
                  replayScope: "WITHDRAW",
                  body: JSON.stringify({
                    bucket: withdrawBucket,
                    amountCents: gross,
                    currency: displayCurrency,
                    provider: payoutProvider,
                    phone,
                    idempotencyKey,
                  }),
                },
              );
              if (!res.ok) {
                toast.error(data?.error ?? "Retrait impossible");
                return;
              }
              clearPaymentIdempotencyKey(intent);
              toast.success(
                `Sortie -${formatMoney(gross - fee, displayCurrency)} vers ${phone}`,
              );
              setPots((prev) => ({
                ...prev,
                [withdrawBucket]: Math.max(0, prev[withdrawBucket] - gross),
              }));
              setBalance((current) => Math.max(0, current - gross));
              setBalances((prev) => ({
                ...prev,
                [displayCurrency]: Math.max(0, prev[displayCurrency] - gross),
              }));
              notifyWalletUpdated();
              await refresh();
            } catch (error) {
              toast.message(t("wallet.connectionLost"));
              toast.error(
                error instanceof Error ? error.message : "Retrait interrompu",
              );
            } finally {
              setWithdrawing(false);
            }
          }}
        >
          Retirer le pot{" "}
          {withdrawBucket === "BUYER"
            ? "à dépenser"
            : withdrawBucket === "VENDOR"
              ? "ventes"
              : "courses"}
        </Button>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-heading text-sm font-bold">
          {t("wallet.topUpSimulated")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("me");
              setPicked(null);
              setProvider((prev) => prev ?? "MPESA");
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
            onClick={() => {
              setTab("someone");
              setProvider(null);
            }}
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

        <div
          className={cn(
            "grid gap-2",
            tab === "someone" ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (tab === "someone" && provider === p.id) {
                  setProvider(null);
                  return;
                }
                setProvider(p.id);
              }}
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
          {tab === "someone" ? (
            <button
              type="button"
              onClick={() => setProvider(null)}
              className={cn(
                "rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-500 p-3 text-center text-[11px] font-bold leading-tight",
                !provider &&
                  "ring-2 ring-white ring-offset-2 ring-offset-background",
              )}
            >
              {t("wallet.fromBalance")}
            </button>
          ) : null}
        </div>
        {payFromBalance ? (
          <p className="text-[11px] text-muted-foreground">
            {t("wallet.balanceHint")}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-muted-foreground">
              {t("wallet.emoneyPhone")}
            </p>
            {provider ? (
              <PhoneField
                id="wallet-phone"
                label={t(PROVIDERS.find((p) => p.id === provider)!.label)}
                value={contacts[provider]}
                onChange={(v) =>
                  setContacts((prev) => ({ ...prev, [provider]: v }))
                }
              />
            ) : null}
          </>
        )}
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
            {loading
              ? "…"
              : payFromBalance
                ? t("wallet.sendFromBalance")
                : t("wallet.sendPay")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm">{ussdHint ?? t("wallet.ussdHint")}</p>
            {paymentUrl ? (
              <Button
                type="button"
                onClick={() => window.location.assign(paymentUrl)}
                className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] font-bold"
              >
                {t("wallet.sendPay")}
              </Button>
            ) : null}
            <Button
              onClick={confirm}
              disabled={loading}
              className="h-12 w-full bg-gradient-to-r from-trust to-[#00b377] font-bold"
            >
              {loading ? "…" : t("wallet.confirmPay")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={checking || loading}
              onClick={() => void verifyState()}
              className="h-10 w-full"
            >
              {checking ? "…" : t("wallet.verifyState")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="font-heading text-sm font-bold">
          {t("wallet.myNumbers")}
        </h2>
        {PROVIDERS.map((p) => (
          <PhoneField
            key={p.id}
            id={`contact-${p.id}`}
            label={t(p.label)}
            value={contacts[p.id]}
            onChange={(v) => setContacts((prev) => ({ ...prev, [p.id]: v }))}
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
        <h2 className="mb-3 font-heading text-sm font-bold">
          {t("wallet.history")}
        </h2>
        <ul className="space-y-2">
          {txns.map((row) => {
            const failed = row.status === "FAILED" || row.status === "EXPIRED";
            const pending = row.status === "PENDING";
            const outgoing = txnOutgoing(row);
            return (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {txnLabel(row)} · {providerName(row.provider)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.type === "WITHDRAWAL" && failed
                      ? "Échoué — pot recrédité"
                      : failed
                        ? "Échoué — pot non débité"
                        : pending
                          ? "En attente — solde inchangé"
                          : row.type === "WITHDRAWAL"
                            ? "Sortie"
                            : row.status}{" "}
                    · {new Date(row.createdAt).toLocaleString("fr-FR")}
                    {!pending && !failed && row.balanceAfterCents != null
                      ? ` · ${formatMoney(row.balanceAfterCents, row.currency)}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-heading font-bold",
                    failed || pending
                      ? "text-muted-foreground"
                      : outgoing
                        ? "text-destructive"
                        : "text-trust",
                  )}
                >
                  {outgoing ? "-" : "+"}
                  {formatMoney(Math.abs(row.amountCents), row.currency)}
                </span>
              </li>
            );
          })}
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
