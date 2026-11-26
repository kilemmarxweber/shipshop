import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { normalizePublicUploadUrl } from "./src/lib/upload-url";

const publicUploadUrl = normalizePublicUploadUrl(
  process.env.NEXT_PUBLIC_UPLOAD_URL,
);

const skipTsc =
  process.env.SHIPSHOP_BUILD_SKIP_TSC === "1" ||
  process.env.SHIPSHOP_BUILD_SKIP_TSC === "true";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // VPS 2 Go : le typecheck Next pendant `next build` OOM (exit 137).
  // Activer avec SHIPSHOP_BUILD_SKIP_TSC=1 (script build:vps). Sinon `pnpm typecheck`.
  typescript: {
    ignoreBuildErrors: skipTsc,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
    ],
  },
  experimental: {
    // Aligné sur VIDEO_INPUT_MAX_BYTES (100 Mo) — compression vidéo côté serveur
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
    },
    // GC Turbopack en prod seulement — en `next dev` il peut paniquer
    // (stale TaskId / already-collected) après un build.
    turbopackGc: process.env.NODE_ENV === "production",
    // Node 24 : workerThreads peut abort (N-API / fsevents). childProcesses = défaut sûr.
    turbopackPluginRuntimeStrategy: "childProcesses",
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: `${publicUploadUrl}/:path*`,
          destination: "/api/uploads/:path*",
        },
      ],
    };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  telemetry: false,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
