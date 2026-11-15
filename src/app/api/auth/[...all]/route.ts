import { auth } from "@/lib/auth";
import { ACCESS_TEMPORARILY_LIMITED_FR } from "@/lib/security/user-messages";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

/** Better Auth renvoie un message anglais figé sur 429 — on le remplace. */
async function withFrenchRateLimit(
  request: Request,
  run: (req: Request) => Promise<Response>,
) {
  const response = await run(request);
  if (response.status !== 429) return response;

  const retryAfter =
    response.headers.get("X-Retry-After") ??
    response.headers.get("Retry-After") ??
    "60";

  const headers = new Headers(response.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Retry-After", retryAfter);
  headers.set("Cache-Control", "no-store");

  return new Response(
    JSON.stringify({
      message: ACCESS_TEMPORARILY_LIMITED_FR,
      error: ACCESS_TEMPORARILY_LIMITED_FR,
      code: "RATE_LIMITED",
    }),
    {
      status: 429,
      statusText: "Too Many Requests",
      headers,
    },
  );
}

export async function GET(request: Request) {
  return withFrenchRateLimit(request, (req) => handler.GET(req));
}

export async function POST(request: Request) {
  return withFrenchRateLimit(request, (req) => handler.POST(req));
}
