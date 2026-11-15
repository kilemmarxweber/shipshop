import { handleHoneypotHit } from "@/lib/security";
import { getSession } from "@/lib/session";

/**
 * Route piège anti-scraping — ne pas lier depuis l'UI, le sitemap ou le prefetch.
 * Réponse trompeuse ; sanction temporaire uniquement (voir honeypot.ts).
 */
export async function GET(request: Request) {
  const session = await getSession();
  return handleHoneypotHit({
    request,
    userId: session?.user?.id ?? null,
    sessionId: session?.session?.id ?? null,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
