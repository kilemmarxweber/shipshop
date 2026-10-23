"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { usePageBack } from "@/components/back-nav-context";

type LiveRow = {
  id: string;
  title: string;
  status?: string;
  giftCents: number;
  user: { name: string; image: string | null };
  product: { title: string; images: string[]; priceCents: number } | null;
};

export default function LiveListPage() {
  usePageBack({ fallbackHref: "/" });
  const [lives, setLives] = useState<LiveRow[]>([]);

  useEffect(() => {
    void fetchJson<{ lives?: LiveRow[] }>("/api/growth/lives").then(({ data }) =>
      setLives(data?.lives ?? []),
    );
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-bold">Lives</h1>
        <Link href="/creator" className="text-xs font-semibold text-primary">
          Lancer un live
        </Link>
      </div>
      {lives.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucun live en cours. Influenceurs (2 000 abonnés) ou owner peuvent
          démarrer.
        </p>
      ) : (
        <ul className="space-y-2">
          {lives.map((live) => (
            <li key={live.id}>
              <Link
                href={`/live/${live.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3"
              >
                <span
                  className={
                    live.status === "PAUSED"
                      ? "grid size-10 place-items-center rounded-full bg-amber-500/20 text-amber-600"
                      : "grid size-10 place-items-center rounded-full bg-destructive/20 text-destructive"
                  }
                >
                  <Radio className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {live.status === "PAUSED" ? (
                      <span className="mr-1.5 text-[10px] font-extrabold text-amber-600">
                        PAUSE
                      </span>
                    ) : null}
                    {live.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {live.user.name}
                    {live.product ? ` · ${live.product.title}` : ""}
                  </p>
                </div>
                <p className="text-[10px] font-bold text-trust">
                  {formatMoney(live.giftCents)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
