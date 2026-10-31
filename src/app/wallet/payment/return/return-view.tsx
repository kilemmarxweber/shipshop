"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/utils";

type StatusPayload = {
  error?: string;
  status?: string;
  amountCents?: number;
  currency?: string;
  reference?: string;
  paymentMethod?: string | null;
};

export function CinetPayReturnView({ appName }: { appName: string }) {
  const [tx, setTx] = useState<string | null>(null);
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("tx");
    setTx(id);
    if (!id) {
      setLoading(false);
      return;
    }
    let stop = false;
    async function load(current: string) {
      try {
        const res = await fetch(
          `/api/payments/cinetpay/status?tx=${encodeURIComponent(current)}`,
        );
        const json = (await res.json()) as StatusPayload;
        if (stop) return;
        setData(
          !res.ok && !json.error
            ? { error: "Impossible de vérifier le paiement. Réessayez." }
            : json,
        );
      } catch {
        if (stop) return;
        setData({ error: "Impossible de vérifier le paiement. Réessayez." });
      } finally {
        if (!stop) setLoading(false);
      }
    }
    void load(id);
    return () => {
      stop = true;
    };
  }, []);

  const posted = data?.status === "POSTED";
  const failed = data?.status === "REJECTED" || data?.status === "FAILED";
  const title = loading
    ? "Vérification du paiement"
    : posted
      ? "Paiement confirmé"
      : failed
        ? "Paiement refusé"
        : data?.error
          ? "Vérification impossible"
          : "Paiement en attente";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <img
        src="/shipshop-logo.png"
        alt={appName}
        className="h-16 w-16 rounded-2xl object-cover"
      />
      <p className="mt-4 font-heading text-sm font-bold tracking-wide text-primary">
        {appName}
      </p>
      <h1 className="mt-2 font-heading text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {loading
          ? "CinetPay est en train d'être relu. Le portefeuille n'est crédité qu'une fois le paiement accepté."
          : posted
            ? "CinetPay a accepté la transaction. Le montant est sur le portefeuille ShipShop."
            : failed
              ? "CinetPay a refusé la transaction. Aucun montant n'a été crédité."
              : data?.error
                ? data.error
                : "Le guichet CinetPay n'a pas encore confirmé. Revenez après le paiement, ou rouvrez cette page."}
      </p>
      {data?.amountCents != null && data.currency ? (
        <p className="mt-6 font-heading text-3xl font-bold">
          {formatMoney(data.amountCents, data.currency)}
        </p>
      ) : null}
      {tx ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Transaction CinetPay · {tx}
          {data?.paymentMethod ? ` · ${data.paymentMethod}` : ""}
        </p>
      ) : null}
      <Link
        href="/wallet"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-[#ff5722] to-[#ff7a45] px-6 font-bold text-white"
      >
        Retour au portefeuille
      </Link>
    </main>
  );
}
