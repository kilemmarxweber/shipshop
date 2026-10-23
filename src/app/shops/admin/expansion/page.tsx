"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Globe } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { usePageBack } from "@/components/back-nav-context";

type Wave = {
  id: string;
  title: string;
  weeks: string;
  cities: string[];
  languages: string[];
  partnerFocus: string[];
  launchChecklist: string[];
};

export default function ExpansionPlaybookPage() {
  const { data: session, isPending } = authClient.useSession();
  usePageBack({ fallbackHref: "/shops" });
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [approach, setApproach] = useState("");
  const [locales, setLocales] = useState<string[]>([]);

  useEffect(() => {
    if (!session) return;
    void fetchJson<{
      waves?: Wave[];
      approach?: string;
      localesReady?: string[];
    }>("/api/admin/expansion-playbook").then(({ res, data }) => {
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      setWaves(data?.waves ?? []);
      setApproach(data?.approach ?? "");
      setLocales(data?.localesReady ?? []);
    });
  }, [session?.user?.id]);

  if (isPending || (session && allowed === null)) return <PageLoader />;
  if (!session || allowed === false) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <div>
        <Link
          href="/shops"
          className="mb-2 inline-flex items-center gap-1 text-xs text-primary"
        >
          <ArrowLeft className="size-3" /> Boutiques
        </Link>
        <h1 className="flex items-center gap-2 font-heading text-xl font-bold">
          <Globe className="size-5 text-primary" /> Expansion
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {approach}. Locales prêtes : {locales.join(", ")}.
        </p>
      </div>
      {waves.map((wave) => (
        <section
          key={wave.id}
          className="rounded-2xl border border-border bg-surface p-4"
        >
          <p className="text-sm font-bold">{wave.title}</p>
          <p className="text-[11px] text-muted-foreground">{wave.weeks}</p>
          <p className="mt-2 text-xs">
            Villes : {wave.cities.join(", ")}
          </p>
          <p className="text-xs">Langues : {wave.languages.join(", ")}</p>
          <p className="text-xs">
            Partenaires : {wave.partnerFocus.join(", ")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {wave.launchChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
