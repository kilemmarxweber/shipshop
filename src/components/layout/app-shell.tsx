"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Home,
  Search,
  Plus,
  User,
  Wallet,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { BackNavProvider } from "@/components/back-nav-context";
import { LocaleToggle } from "@/components/locale-toggle";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsBell } from "@/components/notifications-bell";
import { useInboxUnread } from "@/hooks/use-inbox-unread";
import { useI18n } from "@/components/i18n-provider";

const NAV = [
  { href: "/", key: "home" as const, icon: Home },
  { href: "/discover", key: "discover" as const, icon: Search },
  { href: "/publish", key: "publish" as const, icon: Plus, accent: true },
  { href: "/messages", key: "messages" as const, icon: MessageCircle },
  { href: "/cart", key: "cart" as const, icon: ShoppingCart },
] as const;

function BrandLabel({ name }: { name: string }) {
  const compact = name.replace(/\s+/g, "") || "ShipShop";
  const shopAt = compact.toLowerCase().lastIndexOf("shop");
  const prefix = shopAt > 0 ? compact.slice(0, shopAt) : compact;
  const shop = shopAt >= 0 ? compact.slice(shopAt) : "";
  return (
    <>
      <span className="text-trust md:hidden">shop</span>
      <span className="hidden md:inline">
        {prefix}
        <span className="text-trust">{shop}</span>
      </span>
    </>
  );
}

export function AppShell({
  children,
  appName,
}: {
  children: React.ReactNode;
  appName: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [balance, setBalance] = useState<number | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const inbox = useInboxUnread(userId, pathname);

  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setCartCount(0);
      return;
    }
    Promise.all([
      fetchJson<{ wallet?: { balanceCents?: number } }>("/api/wallet"),
      fetchJson<{ count?: number }>("/api/cart"),
    ])
      .then(([wallet, cart]) => {
        setBalance(wallet.data?.wallet?.balanceCents ?? 0);
        setCartCount(cart.data?.count ?? 0);
      })
      .catch(() => {
        setBalance(null);
        setCartCount(0);
      });
  }, [userId, pathname]);

  const hideChrome =
    pathname.startsWith("/auth") || pathname.startsWith("/onboarding");
  // Racines onglets : pas de bouton retour (le bas nav suffit)
  const hideBackOn = new Set([
    "/",
    "/discover",
    "/publish",
    "/messages",
    "/cart",
  ]);
  const showBack = !hideChrome && !hideBackOn.has(pathname);

  const { urgentCount, unreadMessages } = inbox;

  return (
    <BackNavProvider>
      <div className="app-viewport">
        <div className="app-shell">
          {!hideChrome && (
            <header className="z-40 shrink-0 border-b border-border bg-background/90 px-4 pb-1.5 pt-2.5 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/"
                  aria-label={appName}
                  className="flex min-w-0 shrink items-center gap-1.5 md:gap-2"
                >
                  <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-transparent">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/shipshop-logo.png"
                      alt=""
                      className="size-8 object-contain"
                    />
                  </div>
                  <span className="font-heading truncate text-lg font-bold tracking-tight whitespace-nowrap">
                    <BrandLabel name={appName} />
                  </span>
                </Link>
                <div className="flex items-center gap-2">
                  {session && (
                    <>
                      <Link
                        href="/wallet"
                        className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-trust transition hover:bg-muted"
                      >
                        <Wallet className="size-3.5" />
                        {balance === null ? "…" : formatMoney(balance)}
                      </Link>
                      <Link
                        href="/cart"
                        className="relative grid size-9 place-items-center rounded-full border border-border bg-muted/50"
                        aria-label={t("nav.cart")}
                      >
                        <ShoppingCart className="size-4" />
                        {cartCount > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold">
                            {cartCount > 9 ? "9+" : cartCount}
                          </span>
                        )}
                      </Link>
                      <NotificationsBell
                        userId={userId}
                        unreadMessages={unreadMessages}
                        urgentCount={urgentCount}
                        conversations={inbox.conversations}
                        refreshing={inbox.refreshing}
                        onRefresh={() => void inbox.refresh({ silent: true })}
                        onOpenConversation={inbox.markConversationSeen}
                      />
                    </>
                  )}
                  <LocaleToggle />
                  <ThemeToggle />
                  {!session && (
                    <Link
                      href="/auth/login"
                      className="relative grid size-9 place-items-center rounded-full border border-border bg-muted/50 text-foreground"
                      aria-label={t("nav.notifications")}
                    >
                      <Bell className="size-4" />
                    </Link>
                  )}
                  <Link
                    href={session ? "/profile" : "/auth/login"}
                    prefetch={false}
                    className="grid size-9 place-items-center overflow-hidden rounded-full border border-border bg-muted/50"
                    aria-label={t("nav.profile")}
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
              "app-main",
              !hideChrome &&
                "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
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
            <nav className="absolute bottom-0 left-0 right-0 z-40 shrink-0 border-t border-border bg-background/92 px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
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
                      prefetch={item.href === "/publish" ? false : undefined}
                      scroll={false}
                      onClick={(e) => {
                        if (
                          item.href === "/publish" &&
                          pathname.startsWith("/publish")
                        ) {
                          e.preventDefault();
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {item.href === "/publish" ? (
                        <span
                          className={cn(
                            "relative grid h-7 w-10 place-items-center rounded-lg bg-gradient-to-br from-[#ff5722] via-[#ff7a45] to-[#00d68f]",
                            !active && "motion-safe:animate-publish-attract",
                          )}
                        >
                          {!active && (
                            <span
                              aria-hidden
                              className="pointer-events-none absolute inset-0 rounded-lg shadow-[0_0_0_2px_rgba(255,87,34,0.55)] motion-safe:animate-publish-ring"
                            />
                          )}
                          <Icon
                            className={cn(
                              "relative size-4 text-white",
                              !active && "motion-safe:animate-publish-plus",
                            )}
                          />
                        </span>
                      ) : (
                        <span className="relative">
                          <Icon className="size-5" />
                          {item.href === "/cart" && cartCount > 0 && (
                            <span className="absolute -top-1 -right-2 grid min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[8px] font-bold text-white">
                              {cartCount > 9 ? "9+" : cartCount}
                            </span>
                          )}
                          {item.href === "/messages" &&
                            (urgentCount > 0 || unreadMessages > 0) && (
                              <span
                                className={cn(
                                  "absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full px-0.5 text-[8px] font-bold shadow",
                                  urgentCount > 0
                                    ? "size-4 bg-amber-500 text-black"
                                    : "bg-primary text-white",
                                )}
                              >
                                {urgentCount > 0 ? (
                                  <AlertTriangle className="size-2.5" />
                                ) : unreadMessages > 9 ? (
                                  "9+"
                                ) : (
                                  unreadMessages
                                )}
                              </span>
                            )}
                        </span>
                      )}
                      <span>{t(`nav.${item.key}`)}</span>
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
