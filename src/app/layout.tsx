import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tpq.darussolah.workers.dev"),
  title: "SIMADJI — TPQ Darul Jinan | Sistem Informasi Manajemen Terpadu",
  description:
    "Platform digital TPQ Darul Jinan: portal publik, PPDB online, absensi QR, hafalan santri, keuangan, dan portal wali santri.",
  keywords: ["TPQ", "Darul Jinan", "Taman Pendidikan Al-Qur'an", "SIMADJI", "PPDB", "absensi santri"],
  authors: [{ name: "TPQ Darul Jinan" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "TPQ Darul Jinan — Taman Pendidikan Al-Qur'an",
    description:
      "Mendidik generasi Qur'ani yang hafal, paham, dan berakhlak mulia. PPDB online, portal wali santri, dan manajemen TPQ terpadu.",
    url: "https://tpq.darussolah.workers.dev",
    siteName: "SIMADJI — TPQ Darul Jinan",
    locale: "id_ID",
    type: "website",
    images: [{ url: "/images/hero-mosque.jpg", width: 1200, height: 630, alt: "TPQ Darul Jinan" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "TPQ Darul Jinan — Taman Pendidikan Al-Qur'an",
    description: "Portal digital TPQ Darul Jinan: PPDB online, absensi, hafalan, dan portal wali santri.",
    images: ["/images/hero-mosque.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        {/* Cloudflare Web Analytics (token ini memang dirancang publik di HTML) */}
        <script
          type="module"
          async
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: "3994e20d28cd4d2180409d2adf8e76c9" })}
        />
      </body>
    </html>
  );
}
