"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { PageLoader } from "@/components/page-loader";
import { Button } from "@/components/ui/button";

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const invitationId = params.get("invitationId");
  const [loading, setLoading] = useState(false);

  async function accept() {
    if (!invitationId) return;
    setLoading(true);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Invitation invalide");
      return;
    }
    toast.success("Vous avez rejoint l'organisation");
    router.push("/shops");
  }

  async function reject() {
    if (!invitationId) return;
    setLoading(true);
    await authClient.organization.rejectInvitation({ invitationId });
    setLoading(false);
    toast.message("Invitation refusée");
    router.push("/");
  }

  if (!invitationId) {
    return (
      <p className="p-8 text-center text-muted-foreground">
        Lien d&apos;invitation invalide
      </p>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-5 text-center">
      <BackButton fallbackHref="/" />
      <h1 className="font-heading text-2xl font-bold">Invitation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vous avez été invité à rejoindre une organisation Chip Shop.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Button
          onClick={accept}
          disabled={loading}
          className="h-12 bg-gradient-to-r from-[#ff5722] to-[#ff7a45] font-bold"
        >
          Accepter
        </Button>
        <Button variant="secondary" onClick={reject} disabled={loading}>
          Refuser
        </Button>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AcceptInviteInner />
    </Suspense>
  );
}
