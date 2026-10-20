import type { NextConfig } from "next";
import { normalizePublicUploadUrl } from "./src/lib/upload-url";

const publicUploadUrl = normalizePublicUploadUrl(
  process.env.NEXT_PUBLIC_UPLOAD_URL,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
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
    turbopackPluginRuntimeStrategy: "workerThreads",
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

export default nextConfig;
