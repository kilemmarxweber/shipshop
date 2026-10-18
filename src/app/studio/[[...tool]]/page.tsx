import { isSanityConfigured } from "@/lib/sanity/env";

export default async function StudioPage() {
  if (!isSanityConfigured()) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-heading text-lg font-bold">Studio indisponible</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ajoutez NEXT_PUBLIC_SANITY_PROJECT_ID et le dataset dans
          l’environnement, puis rouvrez cette page.
        </p>
      </div>
    );
  }
  const { StudioClient } = await import("./studio-client");
  return <StudioClient />;
}
