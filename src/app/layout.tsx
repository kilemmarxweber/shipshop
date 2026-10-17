import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoader } from "@/components/page-loader";
import { Providers } from "@/components/providers";
import { getAppName } from "@/lib/app-name";
import { USER_LOCALE_COOKIE, normalizeUserLocale } from "@/lib/user-locale";
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
  title: "ShipShop — Marketplace de confiance RDC",
  description:
    "Achetez et vendez en sécurité avec portefeuille Mobile Money prépayé.",
  icons: {
    icon: "/shipshop-logo.png",
    apple: "/shipshop-logo.png",
  },
};

async function LocaleProviders({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const locale = normalizeUserLocale(jar.get(USER_LOCALE_COOKIE)?.value);
  return (
    <Providers initialLocale={locale}>
      <AppShell appName={getAppName()}>{children}</AppShell>
    </Providers>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${dmSans.variable} ${spaceGrotesk.variable} h-full`}
    >
      <body className="h-full overflow-hidden font-sans antialiased">
        <Suspense fallback={<PageLoader fullScreen />}>
          <LocaleProviders>{children}</LocaleProviders>
        </Suspense>
      </body>
    </html>
  );
}
