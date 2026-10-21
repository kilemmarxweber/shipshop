"use client";

import { useState } from "react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/components/ui/button";
import { BOOST_PACKS } from "@/lib/shop-boost";

export function ProductCommerceTools({
  productId,
  creatorCommissionBps,
  canManage,
  canClaimCreator,
}: {
  productId: string;
  creatorCommissionBps: number;
  canManage: boolean;
  canClaimCreator: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [bps, setBps] = useState(creatorCommissionBps);

  async function boost(days: 1 | 3 | 7) {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${productId}/boost`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Boost impossible");
      return;
    }
    toast.success("ShipBoost activé");
  }

  async function saveCreatorBps() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/products/${productId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorCommissionBps: bps }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Commission non enregistrée");
      return;
    }
    toast.success("Commission créateur enregistrée");
  }

  async function claim() {
    setBusy(true);
    const { res, data } = await fetchJson<{ error?: string; via?: string }>(
      `/api/products/${productId}/creator`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(data?.error ?? "Affiliation impossible");
      return;
    }
    toast.success("Produit ajouté à ShipCreator — partage le lien de la fiche");
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      {canManage ? (
        <>
          <p className="text-[11px] font-semibold">ShipBoost</p>
          <div className="flex flex-wrap gap-1.5">
            {BOOST_PACKS.map((pack) => (
              <Button
                key={pack.days}
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void boost(pack.days as 1 | 3 | 7)}
              >
                {pack.days} j · ${(pack.usdCents / 100).toFixed(0)}
              </Button>
            ))}
          </div>
          <p className="text-[11px] font-semibold">ShipCreator (bps, 1000 = 10 %)</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={5000}
              value={bps}
              onChange={(e) => setBps(Number(e.target.value) || 0)}
              className="h-8 w-24 rounded-lg border border-border bg-surface-2 px-2 text-xs"
            />
            <Button size="sm" disabled={busy} onClick={() => void saveCreatorBps()}>
              Ouvrir aux créateurs
            </Button>
          </div>
        </>
      ) : null}
      {canClaimCreator && creatorCommissionBps > 0 ? (
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void claim()}>
          Recommander ce produit ({(creatorCommissionBps / 100).toFixed(1)} %)
        </Button>
      ) : null}
    </div>
  );
}
