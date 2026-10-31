"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";

type Summary = {
  pointsBalance: number;
  sellerTier: string;
  commissionGrantRemaining: number;
  commissionBpsOff: number;
  shipCashMonthCents: number;
};

export function ShipRewardsDashboard({ shopId }: { shopId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!shopId) return;
    void fetchJson<Summary>(`/api/shiprewards/summary?shopId=${shopId}`).then(
      ({ data }) => {
        if (data && typeof data.pointsBalance === "number") setSummary(data);
      },
    );
  }, [shopId]);

  if (!shopId || !summary) return null;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold">ShipRewards</p>
        <Link
          href="/help/vendeur/shiprewards"
          className="text-[11px] font-semibold text-primary"
        >
          Aide
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground">Palier</p>
          <p className="font-bold">{summary.sellerTier}</p>
        </div>
        <div>
          <p className="text-muted-foreground">ShipPoints</p>
          <p className="font-bold">{summary.pointsBalance}</p>
        </div>
        <div>
          <p className="text-muted-foreground">ShipCash (mois)</p>
          <p className="font-bold">{formatMoney(summary.shipCashMonthCents)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Quota −1 %</p>
          <p className="font-bold">{summary.commissionGrantRemaining} ventes</p>
        </div>
      </div>
    </div>
  );
}
