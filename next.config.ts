import type { NextConfig } from "next";

const publicUploadUrl = (
  process.env.NEXT_PUBLIC_UPLOAD_URL?.trim() || "/uploads"
).replace(/\/+$/, "") || "/uploads";

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
