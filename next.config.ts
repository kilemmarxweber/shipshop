import type { NextConfig } from "next";
import { normalizePublicUploadUrl } from "./src/lib/upload-url";

const publicUploadUrl = normalizePublicUploadUrl(
  process.env.NEXT_PUBLIC_UPLOAD_URL,
);

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    proxyClientMaxBodySize: "12mb",
    serverActions: {
      bodySizeLimit: "12mb",
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
