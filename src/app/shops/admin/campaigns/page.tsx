"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { formatMoney } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type Pack = {
  objective: "DISCOVERY" | "ENGAGEMENT" | "CONVERSION";
  kind: string;
  minBudgetCents: number;
  maxBudgetCents: number;
};

type Campaign = {
  id: string;
  title: string;
  kind: string;
  objective: string;
  status: string;
  budgetCents: number;
  impressions: number;
  clicks: number;
  conversions: number;
};

export default function CampaignsAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [rows, setRows] = useState<Campaign[]>([]);
  const [title, setTitle] = useState("");
  const [objective, setObjective] =
    useState<Pack["objective"]>("DISCOVERY");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { res, data } = await fetchJson<{
      campaigns?: Campaign[];
      packs?: Pack[];
    }>("/api/admin/brand-campaigns");
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setRows(data?.campaigns ?? []);
    setPacks(data?.packs ?? []);
  }

  useEffect(() => {
    if (session) void load();
  }, [session?.user?.id]);

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  const pack = packs.find((p) => p.objective === objective);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <div>
        <Link
          href="/shops"
          className="mb-2 inline-flex items-center gap-1 text-xs text-primary"
        >
          <ArrowLeft className="size-3" /> Boutiques
        </Link>
        <h1 className="font-heading text-xl font-bold">Packs partenaires</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discovery, Engagement, Conversion — stories natives, pas de taxer le
          feed organique.
        </p>
      </div>

      <div className="grid gap-2">
        {packs.map((p) => (
          <button
            key={p.objective}
            type="button"
            onClick={() => setObjective(p.objective)}
            className={`rounded-2xl border p-3 text-left ${
              objective === p.objective
                ? "border-primary bg-primary/10"
                : "border-border bg-surface"
            }`}
          >
            <p className="text-sm font-bold">{p.objective}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatMoney(p.minBudgetCents)} – {formatMoney(p.maxBudgetCents)} ·{" "}
              {p.kind}
            </p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre campagne"
          className="bg-surface-2"
        />
        <Button
          disabled={busy || !title.trim()}
          onClick={async () => {
            setBusy(true);
            const { res, data } = await fetchJson<{
              campaign?: Campaign;
              error?: string;
            }>("/api/admin/brand-campaigns", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: title.trim(),
                objective,
                status: "ACTIVE",
                budgetCents: pack?.minBudgetCents,
                body: `Pack ${objective}`,
              }),
            });
            setBusy(false);
            if (!res.ok) {
              toast.error(data?.error ?? "Campagne impossible");
              return;
            }
            toast.success("Campagne active");
            setTitle("");
            await load();
          }}
        >
          Lancer
        </Button>
      </div>

      <ul className="space-y-2 text-xs">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-border bg-surface px-3 py-2"
          >
            <p className="font-semibold">
              {row.title} · {row.objective}
            </p>
            <p className="text-muted-foreground">
              {row.status} · {formatMoney(row.budgetCents)} · {row.impressions}{" "}
              vues · {row.clicks} clics · {row.conversions} conv.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
