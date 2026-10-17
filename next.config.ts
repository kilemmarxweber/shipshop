import type { NextConfig } from "next";
import { normalizePublicUploadUrl } from "./src/lib/upload-url";

const publicUploadUrl = normalizePublicUploadUrl(
  process.env.NEXT_PUBLIC_UPLOAD_URL,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Aligné sur VIDEO_INPUT_MAX_BYTES (100 Mo) — compression vidéo côté serveur
    proxyClientMaxBodySize: "100mb",
    serverActions: {
      bodySizeLimit: "100mb",
    },
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
