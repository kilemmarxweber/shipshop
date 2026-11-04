"use client";

import { BackButton } from "@/components/back-button";
import { BackNavProvider } from "@/components/back-nav-context";
import { FoxEmoji } from "@/components/fox-emoji";
import { FoxScrollAdOverlay } from "@/components/fox-scroll-ad-overlay";
import { useI18n } from "@/components/i18n-provider";
import { NewListingFlash } from "@/components/new-listing-flash";
import { NotificationsBell } from "@/components/notifications-bell";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { useInboxUnread } from "@/hooks/use-inbox-unread";
import { useVisualViewportLock } from "@/hooks/use-visual-viewport";
import { authClient } from "@/lib/auth-client";
import { CART_UPDATED_EVENT, cartCountFromEvent } from "@/lib/cart-events";
import { fetchJson } from "@/lib/fetch-json";
import { useBindPageMediaSession } from "@/lib/page-media-session";
import { armFeedSoundUnlock, enableFeedSound } from "@/lib/try-play-media";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    Bell,
    Compass,
    Home,
    MessageCircle,
    Plus,
    ShoppingCart,
    User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", key: "home" as const, icon: Home },
  { href: "/discover", key: "discover" as const, icon: Compass },
  { href: "/publish", key: "publish" as const, icon: Plus, accent: true },
  { href: "/messages", key: "messages" as const, icon: MessageCircle },
  { href: "/cart", key: "cart" as const, icon: ShoppingCart },
] as const;

function compactCount(n: number) {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

function PublishFab() {
  return (
    <span className="app-tabbar-fab" aria-hidden>
      <span className="app-tabbar-fab-layer app-tabbar-fab-fox">
        <FoxEmoji className="size-[52px]" alt="" />
      </span>
      <span className="app-tabbar-fab-layer app-tabbar-fab-plus">
        <Plus className="size-[30px] text-white" strokeWidth={2.6} />
      </span>
    </span>
  );
}

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
      setCartCount(0);
      return;
    }
    void fetchJson<{ count?: number }>("/api/cart")
      .then((cart) => {
        setCartCount(cart.data?.count ?? 0);
      })
      .catch(() => {
        setCartCount(0);
      });
  }, [userId, pathname, cartTick]);

  const liveRoom = pathname.startsWith("/live/");
  const hideChrome =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/studio") ||
    liveRoom;
  const hideBackOn = new Set([
    "/",
    "/discover",
    "/publish",
    "/messages",
    "/cart",
  ]);
  const showBack = !hideChrome && !hideBackOn.has(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (!hideChrome) root.dataset.tabbarOpen = "1";
    else delete root.dataset.tabbarOpen;
    return () => {
      delete root.dataset.tabbarOpen;
    };
  }, [hideChrome]);

  const { urgentCount, unreadMessages } = inbox;
  const feedLayout = pathname === "/" || pathname.startsWith("/shop/");

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
        <div className={cn("app-shell", liveRoom && "app-shell-live")}>
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
                        onChromeNav(event, session ? "/profile" : "/auth/login")
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
                pathname.startsWith("/discover") && "app-main-discover",
                liveRoom && "app-main-live",
                !hideChrome &&
                  !feedLayout &&
                  "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
                feedLayout && "pb-0",
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
              <nav
                className="app-tabbar pointer-events-none absolute right-0 bottom-0 left-0 z-40 h-[calc(4rem+max(0.5rem,env(safe-area-inset-bottom,0px)))] overflow-visible"
                aria-label="Navigation"
              >
                <div className="app-tabbar-shape" aria-hidden />
                <div className="app-tabbar-safe" aria-hidden />
                <div className="pointer-events-auto relative grid h-16 grid-cols-5">
                  {NAV.map((item) => {
                    const active =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    const isPublish = item.href === "/publish";
                    const href =
                      isPublish && !session ? "/auth/login" : item.href;
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        prefetch={false}
                        aria-label={t(`nav.${item.key}`)}
                        data-feed-sound={
                          item.href === "/" || item.href === "/discover"
                            ? "1"
                            : undefined
                        }
                        onClick={(event) => onChromeNav(event, item.href)}
                        className={cn(
                          "flex flex-col items-center overflow-visible pt-2.5 text-[11px] font-bold tabular-nums transition-colors duration-150",
                          isPublish && "justify-start pt-0",
                          active ? "text-[#00D68F]" : "text-white/50",
                        )}
                      >
                        {isPublish ? (
                          <PublishFab />
                        ) : (
                          <span className="relative">
                            <Icon
                              className="size-6"
                              strokeWidth={active ? 2.4 : 1.9}
                              fill={active ? "currentColor" : "none"}
                            />
                            {item.href === "/cart" && cartCount > 0 && (
                              <span className="absolute -top-1 -right-2.5 grid min-w-4 place-items-center rounded-full bg-[#FF7A00] px-0.5 text-[10px] font-extrabold text-white">
                                {compactCount(cartCount)}
                              </span>
                            )}
                            {item.href === "/messages" &&
                              (urgentCount > 0 || unreadMessages > 0) && (
                                <span
                                  className={cn(
                                    "absolute -top-1.5 -right-2.5 grid min-w-4 place-items-center rounded-full px-0.5 text-[10px] font-extrabold shadow",
                                    urgentCount > 0
                                      ? "size-4 bg-amber-500 text-black"
                                      : "bg-[#FF7A00] text-white",
                                  )}
                                >
                                  {urgentCount > 0 ? (
                                    <AlertTriangle className="size-2.5" />
                                  ) : (
                                    compactCount(unreadMessages)
                                  )}
                                </span>
                              )}
                          </span>
                        )}
                        {isPublish ? (
                          <span className="sr-only">{t("nav.publish")}</span>
                        ) : (
                          <span className="mt-0.5">{t(`nav.${item.key}`)}</span>
                        )}
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
