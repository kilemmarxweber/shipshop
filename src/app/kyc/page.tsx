"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { KycCamera } from "@/components/kyc-camera";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadCompressedMedia } from "@/lib/compress-media";
import { cn } from "@/lib/utils";

type Kyc = {
  id: string;
  status: "NONE" | "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  sellerType: "INDIVIDUAL" | "BUSINESS" | null;
  legalName: string | null;
  phone: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  rejectReason: string | null;
  step1Complete: boolean;
  step2Complete: boolean;
};

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export default function KycPage() {
  const { data: session } = authClient.useSession();
  const [kyc, setKyc] = useState<Kyc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [sellerType, setSellerType] = useState<"INDIVIDUAL" | "BUSINESS">(
    "INDIVIDUAL",
  );
  const [legalName, setLegalName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  function apply(next: Kyc | null) {
    setKyc(next);
    if (!next) return;
    if (next.sellerType) setSellerType(next.sellerType);
    setLegalName(next.legalName ?? "");
    setPhone(next.phone ?? "");
    setIdNumber(next.idNumber ?? "");
    setIdFrontUrl(next.idFrontUrl);
    setIdBackUrl(next.idBackUrl);
    setSelfieUrl(next.selfieUrl);
  }

  async function load() {
    const { res, data } = await fetchJson<{ kyc?: Kyc | null; error?: string }>(
      "/api/kyc",
    );
    if (!res.ok) {
      toast.error(data?.error ?? "Impossible de charger le dossier");
      setLoaded(true);
      return;
    }
    const next = data?.kyc ?? null;
    apply(next);
    if (next?.status === "PENDING" || next?.status === "APPROVED") {
      setStep(1);
    } else if (next?.step1Complete && !next.step2Complete) {
      setStep(2);
    }
    setLoaded(true);
  }

  useEffect(() => {
    if (session) load();
  }, [session]);

  async function saveStep1() {
    if (legalName.trim().length < 2) {
      toast.error("Nom légal trop court");
      return;
    }
    if (phone.trim().length < 9) {
      toast.error("Téléphone trop court");
      return;
    }
    if (idNumber.trim().length < 4) {
      toast.error("Numéro de pièce trop court");
      return;
    }
    setBusy(true);
    const { res, data } = await fetchJson<{ kyc?: Kyc; error?: string }>(
      "/api/kyc",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerType,
          legalName: legalName.trim(),
          phone: phone.trim(),
          idNumber: idNumber.trim(),
        }),
      },
    );
    setBusy(false);
    if (!res.ok || !data?.kyc) {
      toast.error(data?.error ?? "Enregistrement impossible");
      return;
    }
    apply(data.kyc);
    setStep(2);
  }

  async function saveDocs(patch: {
    idFrontUrl?: string;
    idBackUrl?: string;
    selfieUrl?: string;
  }) {
    const { res, data } = await fetchJson<{ kyc?: Kyc; error?: string }>(
      "/api/kyc",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      },
    );
    if (!res.ok || !data?.kyc) {
      toast.error(data?.error ?? "Upload enregistré, mais dossier non mis à jour");
      return;
    }
    apply(data.kyc);
  }

  async function submit() {
    setBusy(true);
    const saved = await fetchJson<{ kyc?: Kyc; error?: string }>("/api/kyc", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellerType,
        legalName: legalName.trim(),
        phone: phone.trim(),
        idNumber: idNumber.trim(),
        idFrontUrl,
        idBackUrl,
        selfieUrl,
      }),
    });
    if (!saved.res.ok || !saved.data?.kyc) {
      setBusy(false);
      toast.error(saved.data?.error ?? "Enregistrement impossible");
      return;
    }
    apply(saved.data.kyc);
    const { res, data } = await fetchJson<{ kyc?: Kyc; error?: string }>(
      "/api/kyc",
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok || !data?.kyc) {
      toast.error(data?.error ?? "Soumission impossible");
      return;
    }
    apply(data.kyc);
    toast.success("Dossier envoyé pour revue");
  }

  if (!session) {
    return (
      <div className="px-5 py-16 text-center">
        <p className="font-heading text-lg font-bold">Devenir vendeur pro</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous pour vérifier votre identité
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Connexion
        </Link>
      </div>
    );
  }

  if (!loaded) return <PageLoader label="Dossier KYC" />;

  if (kyc?.status === "PENDING") {
    return (
      <div className="px-4 py-10 text-center md:px-8">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-amber-500/15 text-amber-400">
          <BadgeCheck className="size-6" />
        </div>
        <h1 className="mt-4 font-heading text-lg font-bold">Dossier en revue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          L&apos;équipe Chip Shop examine vos documents. Vous serez notifié
          après décision.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-secondary px-4 text-sm font-medium"
        >
          Retour au profil
        </Link>
      </div>
    );
  }

  if (kyc?.status === "APPROVED") {
    return (
      <div className="px-4 py-10 text-center md:px-8">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-trust text-trust-foreground">
          <BadgeCheck className="size-6" />
        </div>
        <h1 className="mt-4 font-heading text-lg font-bold">Vendeur pro vérifié</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Votre badge PRO est actif sur votre profil.
        </p>
        <Link
          href="/profile"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Voir le profil
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-2 md:px-8">
      <h1 className="font-heading text-lg font-bold">Devenir vendeur pro</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Formulaire, puis photos de pièce d&apos;identité. La vente reste
        possible sans KYC.
      </p>

      {kyc?.status === "REJECTED" && kyc.rejectReason && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="font-semibold text-destructive">Dossier refusé</p>
          <p className="mt-1 text-xs text-muted-foreground">{kyc.rejectReason}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={cn(
            "rounded-xl py-2.5 text-xs font-semibold",
            step === 1
              ? "bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-white"
              : "text-muted-foreground",
          )}
        >
          1. Identité
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={cn(
            "rounded-xl py-2.5 text-xs font-semibold",
            step === 2
              ? "bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-white"
              : "text-muted-foreground",
          )}
        >
          2. Documents
        </button>
      </div>

      {step === 1 ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-3">
          <Label>Type de vendeur</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["INDIVIDUAL", "Particulier"],
                ["BUSINESS", "Entreprise"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSellerType(key)}
                className={cn(
                  "rounded-xl border py-2.5 text-xs font-semibold",
                  sellerType === key
                    ? "border-primary bg-primary/15 text-white"
                    : "border-border text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legalName">Nom légal</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Nom et prénom ou raison sociale"
              className="h-10 bg-surface-2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kycPhone">Téléphone</Label>
            <Input
              id="kycPhone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+243 8XX XXX XXX"
              className="h-10 bg-surface-2"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="idNumber">N° pièce d&apos;identité</Label>
            <Input
              id="idNumber"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="CNI, passeport…"
              className="h-10 bg-surface-2"
            />
          </div>
          <Button
            className="h-10 w-full cursor-pointer"
            disabled={busy}
            onClick={saveStep1}
          >
            {busy ? "…" : "Continuer"}
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-3">
          <DocSlot
            label="Pièce — recto"
            url={idFrontUrl}
            mode="document"
            cameraTitle="Photo du recto"
            cameraHint="Cadrez la pièce, photo nette, caméra arrière de préférence."
            onUploaded={async (url) => {
              setIdFrontUrl(url);
              await saveDocs({ idFrontUrl: url });
            }}
          />
          <DocSlot
            label="Pièce — verso"
            url={idBackUrl}
            mode="document"
            cameraTitle="Photo du verso"
            cameraHint="Cadrez le verso, photo nette, caméra arrière de préférence."
            onUploaded={async (url) => {
              setIdBackUrl(url);
              await saveDocs({ idBackUrl: url });
            }}
          />
          <DocSlot
            label="Selfie"
            url={selfieUrl}
            mode="selfie"
            cameraTitle="Selfie caméra avant"
            cameraHint="Caméra avant obligatoire. Pas de photo depuis la galerie."
            onUploaded={async (url) => {
              setSelfieUrl(url);
              await saveDocs({ selfieUrl: url });
            }}
          />
          <div className="flex gap-2 pt-1">
            <Button
              variant="secondary"
              className="h-10 flex-1 cursor-pointer"
              onClick={() => setStep(1)}
            >
              Retour
            </Button>
            <Button
              className="h-10 flex-1 cursor-pointer"
              disabled={busy || !idFrontUrl || !idBackUrl || !selfieUrl}
              onClick={submit}
            >
              {busy ? "…" : "Soumettre"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

async function uploadKycImage(file: File) {
  if (!IMAGE_TYPES.has(file.type) && !file.type.startsWith("image/")) {
    toast.error("Choisissez une image (JPG, PNG, WebP…)");
    return null;
  }
  try {
    const uploaded = await uploadCompressedMedia(file, "document");
    if (uploaded.kind !== "image") {
      toast.error("Seules les images sont acceptées");
      return null;
    }
    return uploaded.url;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Upload impossible");
    return null;
  }
}

function DocSlot({
  label,
  url,
  mode,
  cameraTitle,
  cameraHint,
  onUploaded,
}: {
  label: string;
  url: string | null;
  mode: "document" | "selfie";
  cameraTitle: string;
  cameraHint: string;
  onUploaded: (url: string) => Promise<void>;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadKycImage(file);
      if (uploaded) await onUploaded(uploaded);
    } finally {
      setUploading(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-2.5">
      {mode === "document" ? (
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      ) : null}
      <div className="flex items-center gap-2.5">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted/40">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">{label}</p>
          <p className="text-[10px] text-muted-foreground">
            {mode === "selfie"
              ? "Caméra avant obligatoire"
              : "Galerie ou photo"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {mode === "document" ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              className="h-8 cursor-pointer gap-1 px-2"
              onClick={() => galleryRef.current?.click()}
            >
              <ImageIcon className="size-3.5" />
              {uploading ? "…" : "Parcourir"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={mode === "selfie" ? "default" : "secondary"}
            size="sm"
            disabled={uploading}
            className="h-8 cursor-pointer gap-1 px-2"
            onClick={() => setCameraOpen(true)}
          >
            <Camera className="size-3.5" />
            {mode === "selfie" ? (url ? "Reprendre" : "Selfie") : "Photo"}
          </Button>
        </div>
      </div>
      {cameraOpen ? (
        <KycCamera
          facing={mode === "selfie" ? "user" : "environment"}
          title={cameraTitle}
          hint={cameraHint}
          onClose={() => setCameraOpen(false)}
          onCapture={async (file) => {
            const uploaded = await uploadKycImage(file);
            if (uploaded) {
              await onUploaded(uploaded);
              setCameraOpen(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
