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
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/fetch-json";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { BackButton } from "@/components/back-button";
import { BackNavProvider } from "@/components/back-nav-context";
import { LocaleToggle } from "@/components/locale-toggle";
import { NewListingFlash } from "@/components/new-listing-flash";
import { FoxScrollAdOverlay } from "@/components/fox-scroll-ad-overlay";
import { NotificationsBell } from "@/components/notifications-bell";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useInboxUnread } from "@/hooks/use-inbox-unread";
import { useVisualViewportLock } from "@/hooks/use-visual-viewport";
import { armFeedSoundUnlock, enableFeedSound } from "@/lib/try-play-media";
import { useI18n } from "@/components/i18n-provider";
import { CART_UPDATED_EVENT, cartCountFromEvent } from "@/lib/cart-events";
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
  const [cartCount, setCartCount] = useState(0);
  const inbox = useInboxUnread(userId, pathname);
  const [cartTick, setCartTick] = useState(0);
  const [hasShop, setHasShop] = useState(false);
  useVisualViewportLock();
  useEffect(() => {
    armFeedSoundUnlock();
  }, []);

  useEffect(() => {
    const bumpCart = (event: Event) => {
      const count = cartCountFromEvent(event);
      if (typeof count === "number") setCartCount(count);
      setCartTick((n) => n + 1);
    };
    window.addEventListener(CART_UPDATED_EVENT, bumpCart);
    return () => {
      window.removeEventListener(CART_UPDATED_EVENT, bumpCart);
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setHasShop(false);
      setCartCount(0);
      return;
    }
    void fetchJson<{ shops?: { id: string }[] }>("/api/shops?mine=1")
      .then(({ data }) => setHasShop((data?.shops?.length ?? 0) > 0))
      .catch(() => setHasShop(false));
    void fetchJson<{ count?: number }>("/api/cart")
      .then((cart) => {
        setCartCount(cart.data?.count ?? 0);
      })
      .catch(() => {
        setCartCount(0);
      });
  }, [userId, pathname, cartTick]);

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
  const feedLayout =
    pathname === "/" || pathname.startsWith("/shop/");

  function onChromeNav(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    const unlockSound = href === "/" || href === "/discover";
    if (unlockSound) enableFeedSound();
    if (pathname === href) {
      event.preventDefault();
      if (href === "/") {
        window.dispatchEvent(new Event("ss:home-feed"));
      }
      if (href === "/discover") {
        window.dispatchEvent(new Event("ss:discover-feed"));
      }
    }
  }

  return (
    <BackNavProvider>
      <div className="app-viewport">
        <div className="app-shell">
          <PullToRefresh>
          {!hideChrome && (
            <header className="z-40 shrink-0 border-b border-border bg-background px-3 pb-1.5 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-4">
              <div className="flex items-center justify-between gap-1.5">
                <Link
                  href="/"
                  aria-label={appName}
                  onClick={(event) => onChromeNav(event, "/")}
                  className="flex min-w-0 items-center gap-1.5 md:gap-2"
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
                <div className="flex items-center justify-end gap-2">
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
                    onClick={(event) =>
                      onChromeNav(
                        event,
                        session ? "/profile" : "/auth/login",
                      )
                    }
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
          {!hideChrome && <FoxScrollAdOverlay />}

          <main
            className={cn(
              "app-main",
              feedLayout && "app-main-feed",
              pathname.startsWith("/shop/") && "app-main-shop-feed",
              pathname.startsWith("/messages/") && "app-main-chat",
              !hideChrome &&
                "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            {showBack && (
              <div className="sticky top-2 z-40 shrink-0 px-4 pt-1">
                <BackButton inline fixed={false} />
              </div>
            )}
            <div
              className={cn(
                "app-page",
                pathname.startsWith("/shop/") && "app-page-shop-feed",
              )}
            >
              {children}
            </div>
          </main>

          {!hideChrome && (
            <nav className="app-tabbar absolute bottom-0 left-0 right-0 z-40 shrink-0 border-t border-border bg-background px-1 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
                      data-feed-sound={
                        item.href === "/" || item.href === "/discover"
                          ? "1"
                          : undefined
                      }
                      onClick={(event) => onChromeNav(event, item.href)}
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
          </PullToRefresh>
        </div>
      </div>
    </BackNavProvider>
  );
}
