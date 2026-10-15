import type { Metadata } from "next";
import { Suspense } from "react";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoader } from "@/components/page-loader";
import { Providers } from "@/components/providers";
import { getAppName } from "@/lib/app-name";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chip Shop — Marketplace de confiance RDC",
  description:
    "Achetez et vendez en sécurité avec portefeuille Mobile Money prépayé.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`dark ${dmSans.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        <Providers>
          <Suspense fallback={<PageLoader fullScreen />}>
            <AppShell appName={getAppName()}>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
