import type { NextConfig } from "next";

// Security headers — perbaikan pertama via AI Fix Bridge (Task 28).
// Temuan modul "headers" pentest: CSP/XFO/HSTS/nosniff belum diset +
// X-Powered-By bocor. CSP dibuat aman untuk Next.js (inline script/style
// diizinkan; blob: untuk preview PDF iframe) namun tetap memblokir
// object/embed, framing pihak luar, dan form-action luar.
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self' blob: data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma: biarkan generated client & prisma client "external" agar OpenNext
  // dapat mem-patch-nya untuk runtime workerd (Cloudflare Workers).
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Temuan pentest: X-Powered-By membocorkan teknologi server
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
