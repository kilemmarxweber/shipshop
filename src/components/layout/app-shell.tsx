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
import { parseCurrency, walletCents, type AppCurrency } from "@/lib/money";
import { cn, formatMoney } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { BackNavProvider } from "@/components/back-nav-context";
import { LocaleToggle } from "@/components/locale-toggle";
import { NewListingFlash } from "@/components/new-listing-flash";
import { NotificationsBell } from "@/components/notifications-bell";
import { useInboxUnread } from "@/hooks/use-inbox-unread";
import { useI18n } from "@/components/i18n-provider";
import { CART_UPDATED_EVENT, cartCountFromEvent } from "@/lib/cart-events";
import { WALLET_UPDATED_EVENT } from "@/lib/wallet-events";
import { useBindPageMediaSession } from "@/lib/page-media-session";

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
  useBindPageMediaSession();
  const { t } = useI18n();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const [balance, setBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState<AppCurrency>("USD");
  const [cartCount, setCartCount] = useState(0);
  const inbox = useInboxUnread(userId, pathname);
  const [walletTick, setWalletTick] = useState(0);
  const [hasShop, setHasShop] = useState(false);

  useEffect(() => {
    const bumpWallet = () => setWalletTick((n) => n + 1);
    const bumpCart = (event: Event) => {
      const count = cartCountFromEvent(event);
      if (typeof count === "number") setCartCount(count);
      setWalletTick((n) => n + 1);
    };
    window.addEventListener(WALLET_UPDATED_EVENT, bumpWallet);
    window.addEventListener(CART_UPDATED_EVENT, bumpCart);
    return () => {
      window.removeEventListener(WALLET_UPDATED_EVENT, bumpWallet);
      window.removeEventListener(CART_UPDATED_EVENT, bumpCart);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setHasShop(false);
      setBalance(null);
      setCartCount(0);
      return;
    }
    void fetchJson<{ shops?: { id: string }[] }>("/api/shops?mine=1")
      .then(({ data }) => setHasShop((data?.shops?.length ?? 0) > 0))
      .catch(() => setHasShop(false));
    Promise.all([
      fetchJson<{
        wallet?: {
          balanceCents?: number;
          currency?: string;
          usdCents?: number;
          cdfCents?: number;
          kwCents?: number;
        };
      }>("/api/wallet"),
      fetchJson<{ count?: number }>("/api/cart"),
    ])
      .then(([wallet, cart]) => {
        const w = wallet.data?.wallet;
        const code = parseCurrency(w?.currency);
        setWalletCurrency(code);
        setBalance(w ? walletCents(w, code) : 0);
        setCartCount(cart.data?.count ?? 0);
      })
      .catch(() => {
        setBalance(null);
        setCartCount(0);
      });
  }, [userId, pathname, walletTick]);

  const hideChrome =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/studio");
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
            <header className="z-40 shrink-0 border-b border-border bg-background/90 px-3 pb-1.5 pt-2.5 backdrop-blur-xl sm:px-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
                <Link
                  href="/"
                  aria-label={appName}
                  className="flex min-w-0 items-center gap-1.5 justify-self-start md:gap-2"
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
                {session ? (
                  <Link
                    href="/wallet"
                    className="flex items-center gap-1.5 justify-self-center rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold text-trust transition hover:bg-muted"
                  >
                    <Wallet className="size-3.5" />
                    <span className="flex flex-col items-start leading-tight">
                      <span>
                        {balance === null
                          ? "…"
                          : formatMoney(balance, walletCurrency)}
                      </span>
                      <span className="text-[9px] font-medium text-trust/90">
                        {t("wallet.heldChip")}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <span />
                )}
                <div className="flex items-center justify-end gap-2 justify-self-end">
                  <LocaleToggle />
                  {session ? (
                    <NotificationsBell
                      userId={userId}
                      unreadMessages={unreadMessages}
                      unreadComments={inbox.unreadComments}
                      urgentCount={urgentCount}
                      conversations={inbox.conversations}
                      comments={inbox.comments}
                    />
                  ) : (
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
          {!hideChrome && <NewListingFlash />}

          <main
            className={cn(
              "app-main",
              pathname.startsWith("/messages/") && "app-main-chat",
              !hideChrome &&
                "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            {showBack && (
              <div className="shrink-0 px-4 pt-1">
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
                      prefetch={false}
                      onClick={(e) => {
                        if (
                          e.metaKey ||
                          e.ctrlKey ||
                          e.shiftKey ||
                          e.altKey ||
                          e.button !== 0
                        ) {
                          return;
                        }
                        e.preventDefault();
                        if (pathname === item.href) {
                          window.location.reload();
                          return;
                        }
                        window.location.assign(item.href);
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
                      <span>
                        {item.href === "/publish" && !hasShop
                          ? t("nav.sellVideo")
                          : t(`nav.${item.key}`)}
                      </span>
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
