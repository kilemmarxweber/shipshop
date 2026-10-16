"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Dossier = {
  id: string;
  status: string;
  sellerType: "INDIVIDUAL" | "BUSINESS" | null;
  legalName: string | null;
  phone: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  submittedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    phone: string | null;
  };
};

export default function ShopsKycPage() {
  const { data: session } = authClient.useSession();
  const [denied, setDenied] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { res, data } = await fetchJson<{
      dossiers?: Dossier[];
      error?: string;
    }>("/api/kyc/admin");
    if (!res.ok) {
      setDenied(true);
      setLoaded(true);
      return;
    }
    setDenied(false);
    setDossiers(data?.dossiers ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function review(id: string, action: "APPROVE" | "REJECT") {
    const rejectReason = reasons[id]?.trim();
    if (action === "REJECT" && !rejectReason) {
      toast.error("Indiquez un motif de refus");
      return;
    }
    setBusyId(id);
    const { res, data } = await fetchJson<{ error?: string }>(
      `/api/kyc/admin/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectReason: action === "REJECT" ? rejectReason : undefined,
        }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      toast.error(data?.error ?? "Action impossible");
      return;
    }
    toast.success(action === "APPROVE" ? "Dossier approuvé" : "Dossier refusé");
    setDossiers((rows) => rows.filter((row) => row.id !== id));
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <Link href="/auth/login" className="text-primary">
          Connexion
        </Link>
      </div>
    );
  }

  if (!loaded) return <PageLoader label="File KYC" />;

  if (denied) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="text-muted-foreground">
          Réservé à l&apos;<strong>owner</strong> ou à un <strong>admin</strong>{" "}
          Chip Shop.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-2 md:px-8">
      <h1 className="font-heading text-lg font-bold">Revue KYC vendeurs</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Dossiers soumis en attente d&apos;approbation.
      </p>

      <ul className="mt-4 space-y-3">
        {dossiers.map((d) => (
          <li
            key={d.id}
            className="space-y-3 rounded-2xl border border-border bg-surface p-3"
          >
            <div>
              <p className="text-sm font-semibold">
                {d.legalName || d.user.name}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {d.user.email} · {d.phone || d.user.phone || "sans tél."} ·{" "}
                {d.sellerType === "BUSINESS" ? "Entreprise" : "Particulier"}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Pièce : {d.idNumber}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <DocPreview label="Recto" url={d.idFrontUrl} />
              <DocPreview label="Verso" url={d.idBackUrl} />
              <DocPreview label="Selfie" url={d.selfieUrl} />
            </div>
            <Textarea
              value={reasons[d.id] ?? ""}
              onChange={(e) =>
                setReasons((prev) => ({ ...prev, [d.id]: e.target.value }))
              }
              placeholder="Motif si refus…"
              className="min-h-16 bg-surface-2 text-sm"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="h-9 flex-1 cursor-pointer"
                disabled={busyId === d.id}
                onClick={() => review(d.id, "REJECT")}
              >
                Refuser
              </Button>
              <Button
                className="h-9 flex-1 cursor-pointer"
                disabled={busyId === d.id}
                onClick={() => review(d.id, "APPROVE")}
              >
                Approuver
              </Button>
            </div>
          </li>
        ))}
        {dossiers.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Aucun dossier en attente
          </p>
        )}
      </ul>
    </div>
  );
}

function DocPreview({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className="aspect-[3/4] w-full object-cover" />
      ) : (
        <div className="grid aspect-[3/4] place-items-center text-[10px] text-muted-foreground">
          —
        </div>
      )}
      <p className="px-1.5 py-1 text-center text-[10px] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
