"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { composePhone, isValidContactPhone, splitPhone } from "@/lib/phone";
import { formatMoney } from "@/lib/utils";
import { notifyWalletUpdated } from "@/lib/wallet-events";
import { PhoneField } from "@/components/phone-field";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { id: "MPESA" as const, label: "M-Pesa" },
  { id: "ORANGE" as const, label: "Orange" },
  { id: "AIRTEL" as const, label: "Airtel" },
];

type Props = {
  neededCents: number;
  balanceCents: number;
  currency?: string;
  onFunded?: () => void;
};

export function WalletInlineTopUp({
  neededCents,
  balanceCents,
  currency = "USD",
  onFunded,
}: Props) {
  const { t } = useI18n();
  const gap = Math.max(100, neededCents - balanceCents);
  const [provider, setProvider] = useState<(typeof PROVIDERS)[number]["id"]>(
    "MPESA",
  );
  const [phone, setPhone] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ussdHint, setUssdHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchJson<{
      contacts?: { provider: string; phone: string }[];
      accountPhone?: string | null;
    }>("/api/wallet")
      .then(({ data }) => {
        const rows = data?.contacts ?? [];
        const first = rows[0];
        if (first && PROVIDERS.some((p) => p.id === first.provider)) {
          setProvider(first.provider as (typeof PROVIDERS)[number]["id"]);
          setPhone(first.phone);
          return;
        }
        if (data?.accountPhone) setPhone(data.accountPhone);
      })
      .catch(() => undefined);
  }, []);

  async function initiate() {
    const parts = splitPhone(phone);
    const e164 = composePhone(parts.dial, parts.national);
    if (!isValidContactPhone(e164)) {
      toast.error(t("buy.phoneRequired"));
      return;
    }
    setLoading(true);
    const idempotencyKey = crypto.randomUUID();
    const { res, data } = await fetchJson<{
      error?: string;
      transactionId?: string;
      ussdHint?: string;
    }>("/api/wallet/deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        action: "initiate",
        provider,
        phone: e164,
        amountCents: gap,
        currency,
        idempotencyKey,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("buy.topUpFailed"));
      return;
    }
    setPendingId(data?.transactionId ?? null);
    setUssdHint(data?.ussdHint ?? null);
    toast.message(data?.ussdHint ?? t("buy.confirmUssd"));
  }

  async function confirm() {
    if (!pendingId) return;
    setLoading(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      "/api/wallet/deposit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", transactionId: pendingId }),
      },
    );
    setLoading(false);
    if (!res.ok) {
      toast.error(data?.error ?? t("buy.topUpFailed"));
      return;
    }
    notifyWalletUpdated();
    toast.success(t("buy.topUpOk"));
    setPendingId(null);
    onFunded?.();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-2 p-3">
      <p className="text-sm">
        {t("buy.needMore")}{" "}
        <span className="font-semibold">
          {formatMoney(neededCents, currency)}
        </span>
        . {t("buy.topUpHint")}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {t("buy.heldLine")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={`h-10 rounded-xl text-[11px] font-bold ${
              provider === p.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-surface"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <PhoneField value={phone} onChange={setPhone} />
      {ussdHint ? (
        <p className="text-xs text-trust">{ussdHint}</p>
      ) : null}
      {pendingId ? (
        <Button
          type="button"
          disabled={loading}
          onClick={() => void confirm()}
          className="h-12 w-full font-bold"
        >
          {loading ? "…" : t("buy.confirmUssd")}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={loading}
          onClick={() => void initiate()}
          className="h-12 w-full font-bold"
        >
          {loading ? "…" : t("buy.payPhone")}
        </Button>
      )}
    </div>
  );
}
