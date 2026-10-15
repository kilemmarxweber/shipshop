"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Home,
  Search,
  Plus,
  User,
  Wallet,
  Bell,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { BackNavProvider } from "@/components/back-nav-context";

const NAV = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/discover", label: "Découvrir", icon: Search },
  { href: "/publish", label: "Publier", icon: Plus, accent: true },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/cart", label: "Panier", icon: ShoppingCart },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    if (!session) {
      setBalance(null);
      setCartCount(0);
      setUrgentCount(0);
      return;
    }
    Promise.all([
      fetchJson<{ wallet?: { balanceCents?: number } }>("/api/wallet"),
      fetchJson<{ count?: number }>("/api/cart"),
      fetchJson<{ conversations?: { urgentPending?: boolean }[] }>(
        "/api/conversations",
      ),
    ])
      .then(([wallet, cart, convos]) => {
        setBalance(wallet.data?.wallet?.balanceCents ?? 0);
        setCartCount(cart.data?.count ?? 0);
        setUrgentCount(
          (convos.data?.conversations ?? []).filter((c) => c.urgentPending)
            .length,
        );
      })
      .catch(() => {
        setBalance(null);
        setCartCount(0);
        setUrgentCount(0);
      });
  }, [session, pathname]);

  const hideChrome =
    pathname.startsWith("/auth") || pathname.startsWith("/onboarding");
  // Pas de retour sur l’accueil ni les onglets du menu bas
  const hideBackOn = new Set([
    "/",
    "/discover",
    "/publish",
    "/messages",
    "/cart",
  ]);
  const showBack = !hideChrome && !hideBackOn.has(pathname);

  return (
    <BackNavProvider>
      <div className="app-viewport">
        <div className="app-shell flex flex-col">
          {!hideChrome && (
            <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0a0a0f]/90 px-4 pb-1.5 pt-2.5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#ff5722] to-[#ff7a45] text-sm font-bold shadow-[0_4px_14px_rgba(255,87,34,0.4)]">
                    CS
                  </div>
                  <span className="font-heading text-lg font-bold tracking-tight">
                    Chip<span className="text-trust">Shop</span>
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  {session && (
                    <>
                      <Link
                        href="/wallet"
                        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-trust transition hover:bg-white/10"
                      >
                        <Wallet className="size-3.5" />
                        {balance === null ? "…" : formatMoney(balance)}
                      </Link>
                      <Link
                        href="/cart"
                        className="relative grid size-9 place-items-center rounded-full border border-white/10 bg-white/5"
                        aria-label="Panier"
                      >
                        <ShoppingCart className="size-4" />
                        {cartCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold">
                            {cartCount > 9 ? "9+" : cartCount}
                          </span>
                        )}
                      </Link>
                    </>
                  )}
                  <button
                    type="button"
                    className="relative grid size-9 place-items-center rounded-full border border-white/10 bg-white/5"
                    aria-label="Notifications"
                  >
                    <Bell className="size-4" />
                  </button>
                  <Link
                    href={session ? "/profile" : "/auth/login"}
                    className="grid size-9 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/5"
                    aria-label="Profil"
                  >
                    {session?.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={session.user.image}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <User className="size-4" />
                    )}
                  </Link>
                </div>
              </div>
            </header>
          )}

          <main
            className={cn(
              "flex-1 overflow-y-auto",
              !hideChrome && "pb-24",
            )}
          >
            {showBack && (
              <div className="px-4 pt-1">
                <BackButton inline />
              </div>
            )}
            {children}
          </main>

          {!hideChrome && (
            <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-white/8 bg-[#0a0a0f]/92 px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:max-w-[960px] lg:max-w-[1024px]">
              <div className="grid grid-cols-5 gap-0.5">
                {NAV.map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {item.href === "/publish" ? (
                        <span className="grid h-7 w-10 place-items-center rounded-lg bg-gradient-to-br from-[#ff5722] via-[#ff7a45] to-[#00d68f]">
                          <Icon className="size-4 text-white" />
                        </span>
                      ) : (
                        <span className="relative">
                          <Icon className="size-5" />
                          {item.href === "/cart" && cartCount > 0 && (
                            <span className="absolute -top-1 -right-2 grid min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-white">
                              {cartCount > 9 ? "9+" : cartCount}
                            </span>
                          )}
                          {item.href === "/messages" && urgentCount > 0 && (
                            <span className="absolute -top-1.5 -right-2.5 grid size-4 place-items-center rounded-full bg-amber-500 text-black shadow">
                              <AlertTriangle className="size-2.5" />
                            </span>
                          )}
                        </span>
                      )}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      </div>
    </BackNavProvider>
  );
}
