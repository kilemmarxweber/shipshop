import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  androidShareDecision,
  installPageHtml,
  sharedAppPath,
} from "./lib/android-app-link";

function originAllowed(origin: string) {
  if (
    origin === "shipshop://" ||
    origin.startsWith("shipshop://") ||
    origin === "exp://" ||
    origin.startsWith("exp://")
  ) {
    return true;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol === "shipshop:" || url.protocol === "exp:") return true;
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return true;
  const extra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return extra.includes(origin);
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key, Accept, Origin, X-ShipShop-Client, X-ShipShop-Install-Id",
    "Access-Control-Expose-Headers": "set-auth-token, Retry-After",
    Vary: "Origin",
  };
}

function androidShareGate(request: NextRequest) {
  const path = sharedAppPath(request.nextUrl.pathname);
  if (!path) return null;
  const decision = androidShareDecision({
    method: request.method,
    pathname: request.nextUrl.pathname,
    web: request.nextUrl.searchParams.get("web") === "1",
    userAgent: request.headers.get("user-agent") ?? "",
    rsc: request.headers.get("rsc") === "1",
    prefetch: Boolean(
      request.headers.get("next-router-prefetch") ||
      request.headers.get("next-router-segment-prefetch"),
    ),
    accept: request.headers.get("accept") ?? "",
    secFetchDest: request.headers.get("sec-fetch-dest"),
  });
  if (decision !== "open-app") return null;
  return new NextResponse(
    request.method === "HEAD" ? null : installPageHtml(path),
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        Vary: "User-Agent",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

export function proxy(request: NextRequest) {
  const share = androidShareGate(request);
  if (share) return share;

  const origin = request.headers.get("origin");
  const allowed = Boolean(origin && originAllowed(origin));
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: allowed && origin ? corsHeaders(origin) : undefined,
    });
  }
  const response = NextResponse.next();
  if (allowed && origin) {
    for (const [key, value] of Object.entries(corsHeaders(origin))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export const config = {
  matcher: ["/api/:path*", "/product/:path*", "/shop/:path*", "/live/:path*"],
};
