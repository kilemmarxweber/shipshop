"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson } from "@/lib/fetch-json";

type CheckResponse = {
  required?: boolean;
};

type SubmitResponse = {
  error?: string;
  code?: string;
  required?: boolean;
};

export default function FirstLoginPasswordPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [checking, setChecking] = useState(true);
  const [required, setRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [identifier, setIdentifier] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOldPassword(window.sessionStorage.getItem("ss:first-login-old-password") ?? "");
      setIdentifier(window.sessionStorage.getItem("ss:first-login-identifier") ?? "");
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    void (async () => {
      setChecking(true);
      const { res, data } = await fetchJson<CheckResponse>(
        "/api/auth/password-reset/first-login",
      );
      if (!res.ok || !data?.required) {
        setRequired(false);
        setChecking(false);
        router.replace("/");
        return;
      }
      setRequired(true);
      setChecking(false);
    })();
  }, [session?.user?.id, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (confirmPassword.length < 8) {
      toast.error("La confirmation doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!oldPassword.trim()) {
      toast.error("L'ancien mot de passe est requis.");
      return;
    }
    if (oldPassword === newPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setBusy(true);
    const { res, data } = await fetchJson<SubmitResponse>(
      "/api/auth/password-reset/first-login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      },
    );
    setBusy(false);

    if (!res.ok) {
      if (data?.code === "OLD_PASSWORD_INVALID") {
        toast.error("Ancien mot de passe incorrect.");
        return;
      }
      if (data?.code === "PASSWORD_CONFIRM_MISMATCH") {
        toast.error("La confirmation ne correspond pas.");
        return;
      }
      toast.error(data?.error ?? "Impossible de changer le mot de passe.");
      return;
    }

    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("ss:first-login-old-password");
      window.sessionStorage.removeItem("ss:first-login-identifier");
    }
    toast.success("Mot de passe changé avec succès.");
    router.replace("/");
    router.refresh();
  }

  if (!session?.user?.id) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <p className="text-center text-sm text-muted-foreground">
          Connecte-toi d'abord.
        </p>
        <Link href="/auth/login" className="mt-4 text-center font-semibold text-primary">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <p className="text-center text-sm text-muted-foreground">Vérification...</p>
      </div>
    );
  }

  if (!required) return null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
      <BackButton fallbackHref="/auth/login" />
      <div className="mb-6 text-center">
        <h1 className="font-heading text-2xl font-bold">Changer le mot de passe</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Première connexion après reset. Confirme ton ancien mot de passe puis définis un nouveau.
        </p>
        {identifier ? (
          <p className="mt-1 text-xs text-muted-foreground">Compte: {identifier}</p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="old-password">Ancien mot de passe</Label>
          <Input
            id="old-password"
            type="password"
            required
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="h-11 bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">Nouveau mot de passe</Label>
          <Input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-11 bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
          <Input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 bg-muted"
          />
        </div>
        <Button
          type="submit"
          disabled={busy}
          className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] text-base font-bold"
        >
          {busy ? "Mise à jour..." : "Mettre à jour le mot de passe"}
        </Button>
      </form>
    </div>
  );
}
