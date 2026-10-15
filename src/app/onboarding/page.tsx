"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) {
      router.push("/auth/login");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/seller/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopName,
        description,
      }),
    });
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(json.error ?? "Impossible de créer la boutique");
      return;
    }

    if (json.organization?.id) {
      await authClient.organization.setActive({
        organizationId: json.organization.id,
      });
    }

    toast.success("Boutique créée sur Chip Shop");
    router.push("/publish");
  }

  return (
    <div className="mx-auto max-w-md px-5 py-10">
      <BackButton />
      <h1 className="font-heading text-2xl font-bold">Devenir vendeur</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Votre compte est déjà member de <strong>Chip Shop</strong>. Créez
        votre boutique — le rôle reste member (l&apos;owner peut le changer).
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div className="space-y-2">
          <Label>Nom de la boutique</Label>
          <Input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="TechKinshasa Store"
            className="h-11 bg-[#1c1c26]"
          />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Électronique vérifiée à Gombe"
            className="min-h-24 bg-[#1c1c26]"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-gradient-to-r from-[#ff5722] to-[#ff7a45] font-bold"
        >
          {loading ? "Création…" : "Lancer ma boutique"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => router.push("/")}
        >
          Continuer comme acheteur
        </Button>
      </form>
    </div>
  );
}
