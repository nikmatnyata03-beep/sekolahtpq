import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma: biarkan generated client & prisma client "external" agar OpenNext
  // dapat mem-patch-nya untuk runtime workerd (Cloudflare Workers).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
