import { NextResponse } from "next/server";

import { ANDROID_PACKAGE } from "@/lib/android-app-link";

/** Pas de `export const dynamic` — incompatible avec cacheComponents (Next 16). */

const FINGERPRINT = /^[0-9A-F]{2}(?::[0-9A-F]{2}){31}$/i;

function fingerprints() {
  return (process.env.ANDROID_SHA256_FINGERPRINTS ?? "")
    .split(/[\s,]+/)
    .map((item) => item.trim().toUpperCase())
    .filter((item) => FINGERPRINT.test(item));
}

export function GET() {
  const sha256 = fingerprints();
  if (sha256.length === 0) {
    return NextResponse.json(
      { error: "ANDROID_SHA256_FINGERPRINTS manquant" },
      { status: 404 },
    );
  }
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: sha256,
        },
      },
    ],
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
