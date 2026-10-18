"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clapperboard, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ReviewRow = {
  id: string;
  kind: string;
  variant: string;
  contentHash: string;
  note: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
};

type Payload = {
  source: "system" | "sanity";
  activeSource: "system" | "sanity";
  sanityConfigured: boolean;
  projectId: string | null;
  dataset: string;
  nsfwReview: boolean;
  rekognitionActive: boolean;
  clipSeconds: number;
  maxImages: number;
  catalogTrackCount: number;
  reviews: ReviewRow[];
  error?: string;
};

export default function AdminContentPage() {
  const { data: session, isPending } = authClient.useSession();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { res, data: json } = await fetchJson<Payload>(
      "/api/admin/content-source",
    );
    if (res.status === 403) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setData(json ?? null);
  }

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [session?.user?.id]);

  async function save(source: "system" | "sanity", nsfwReview: boolean) {
    setBusy(true);
    const { res, data: json } = await fetchJson<{ error?: string }>(
      "/api/admin/content-source",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, nsfwReview }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(json?.error ?? "Enregistrement impossible");
      return;
    }
    toast.success("Source enregistrée");
    await load();
  }

  async function markDone(id: string) {
    setBusy(true);
    await fetchJson("/api/admin/content-source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: data?.source ?? "system",
        reviewId: id,
        reviewStatus: "done",
      }),
    });
    setBusy(false);
    await load();
  }

  if (isPending || loading) {
    return <PageLoader />;
  }
  if (!session) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Connectez-vous pour gérer le contenu.
      </p>
    );
  }
  if (!allowed) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground">
        Réservé à l’owner ShipShop.
      </p>
    );
  }

  const source = data?.source ?? "system";
  const sanityOk = Boolean(data?.sanityConfigured);
  const nsfwReview = Boolean(data?.nsfwReview);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-5">
      <div>
        <h1 className="font-heading text-xl font-bold">Contenu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Une source à la fois : constantes ShipShop, ou Sanity (règles, SEO,
          catalogue). Rekognition reste le scanner NSFW optionnel.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Source des règles</h2>
        <div className="mt-3 space-y-2">
          <label className="flex items-start gap-3 rounded-xl border border-border p-3">
            <input
              type="radio"
              name="content-source"
              className="mt-1"
              checked={source === "system"}
              disabled={busy}
              onChange={() => void save("system", nsfwReview)}
            />
            <span>
              <span className="block text-sm font-medium">Système</span>
              <span className="text-xs text-muted-foreground">
                Minute de son, 12 images, seeds Prisma, fichiers locaux.
              </span>
            </span>
          </label>
          <label
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3",
              sanityOk
                ? "border-border"
                : "border-dashed border-border opacity-60",
            )}
          >
            <input
              type="radio"
              name="content-source"
              className="mt-1"
              checked={source === "sanity"}
              disabled={busy || !sanityOk}
              onChange={() => void save("sanity", nsfwReview)}
            />
            <span>
              <span className="block text-sm font-medium">Sanity</span>
              <span className="text-xs text-muted-foreground">
                {sanityOk
                  ? `Projet ${data?.projectId} · dataset ${data?.dataset}`
                  : "Indisponible : pas de NEXT_PUBLIC_SANITY_PROJECT_ID"}
              </span>
            </span>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Actif : {data?.activeSource === "sanity" ? "Sanity" : "Système"} ·{" "}
          {data?.clipSeconds}s · {data?.maxImages} images ·{" "}
          {data?.catalogTrackCount} sons
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">Médias catalogue</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sons plateforme dans Sanity (CDN). Photos d’annonces restent sur le
          disque en phase 1.
        </p>
        {sanityOk ? (
          <Link
            href="/studio"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground"
          >
            <Clapperboard className="size-4" />
            Ouvrir Studio
          </Link>
        ) : (
          <Button className="mt-3" disabled>
            <Clapperboard className="size-4" />
            Ouvrir Studio
          </Button>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="size-4" />
          NSFW
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pornographie interdite (non désactivable). Rekognition :{" "}
          {data?.rekognitionActive ? "scanner actif" : "pas de clés AWS"}.
        </p>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={nsfwReview}
            disabled={busy}
            onChange={(e) => void save(source, e.target.checked)}
          />
          <span>
            Revue humaine si scan AWS off (mode Sanity). Pas de fichier
            pornographique stocké — file d’empreintes seulement.
          </span>
        </label>
      </section>

      {(data?.reviews?.length ?? 0) > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">File à revoir</h2>
          <ul className="mt-2 space-y-2">
            {data!.reviews.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-border px-3 py-2 text-xs"
              >
                <p className="font-medium">
                  {row.user.name} · {row.kind}/{row.variant}
                </p>
                <p className="mt-0.5 break-all text-muted-foreground">
                  {row.contentHash.slice(0, 24)}…
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={busy}
                  onClick={() => void markDone(row.id)}
                >
                  Marquer traité
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
