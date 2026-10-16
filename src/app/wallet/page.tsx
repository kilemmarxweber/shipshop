"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Smartphone, Wallet } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { formatMoney, cn } from "@/lib/utils";
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
  status: string;
  provider: string;
  phone: string | null;
  reference: string | null;
  createdAt: string;
};

export default function WalletPage() {
  const { data: session } = authClient.useSession();
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [provider, setProvider] = useState<"MPESA" | "ORANGE" | "AIRTEL">("MPESA");
  const [phone, setPhone] = useState("+243");
  const [amount, setAmount] = useState("50");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const res = await fetch("/api/wallet");
    if (!res.ok) return;
    const json = await res.json();
    setBalance(json.wallet?.balanceCents ?? 0);
    setTxns(json.transactions ?? []);
  }

  useEffect(() => {
    if (session) refresh();
  }, [session]);

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">Connectez-vous pour voir votre solde</p>
        <Link
          href="/auth/login"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Connexion
        </Link>
      </div>
    );
  }

  async function initiate() {
    setLoading(true);
    const res = await fetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "initiate",
        provider,
        phone,
        amountCents: Math.round(parseFloat(amount) * 100),
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
    toast.success(`Compte rechargé · ${formatMoney(json.balanceCents)}`);
    setPendingId(null);
    refresh();
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-0">
      <div className="rounded-3xl border border-border bg-gradient-to-br from-[#13131a] to-[#1c1c26] p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" />
          Mon portefeuille
        </div>
        <p className="mt-2 font-heading text-4xl font-extrabold text-trust">
          {formatMoney(balance)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Rechargez via Mobile Money avant d&apos;acheter
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <h2 className="font-heading text-sm font-bold">Recharger (simulé)</h2>
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
        <div className="space-y-2">
          <Label>Numéro e-money</Label>
          <div className="relative">
            <Smartphone className="absolute top-3 left-3 size-4 text-muted-foreground" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-11 bg-surface-2 pl-10"
              placeholder="+243 8XX XXX XXX"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Montant (USD)</Label>
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
        <h2 className="mb-3 font-heading text-sm font-bold">Historique</h2>
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
                {formatMoney(Math.abs(t.amountCents))}
              </span>
            </li>
          ))}
          {txns.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aucune transaction
            </p>
          )}
        </ul>
      </div>
    </div>
  );
}
