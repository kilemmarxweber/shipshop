import { isSanityConfigured } from "@/lib/sanity/env";
import { StudioClient } from "./studio-client";

export const instant = false;

export default function StudioPage() {
  if (!isSanityConfigured()) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-heading text-lg font-bold">Studio indisponible</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Mettez le vrai <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> du projet
          (pas <code>xxxxxxxx</code>) dans <code>.env</code>, puis redémarrez
          <code>pnpm dev</code>.
        </p>
      </div>
    );
  }
  return <StudioClient />;
}
