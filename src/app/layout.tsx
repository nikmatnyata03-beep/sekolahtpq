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
  title: "SIMADJI — TPQ Darul Jinan | Sistem Informasi Manajemen Terpadu",
  description:
    "Platform digital TPQ Darul Jinan: portal publik, PPDB online, absensi QR, hafalan santri, keuangan, dan portal wali santri.",
  keywords: ["TPQ", "Darul Jinan", "Taman Pendidikan Al-Qur'an", "SIMADJI", "PPDB", "absensi santri"],
  authors: [{ name: "TPQ Darul Jinan" }],
  icons: {
    icon: "/logo.svg",
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
      </body>
    </html>
  );
}
