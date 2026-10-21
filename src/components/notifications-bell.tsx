"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, MessageCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { fetchJson } from "@/lib/fetch-json";
import { notifyInboxSeen } from "@/lib/inbox-events";
import {
  useInboxUnread,
  type InboxComment,
  type InboxConversation,
} from "@/hooks/use-inbox-unread";
import { useI18n } from "@/components/i18n-provider";
import { intlLocaleFromUserLocale } from "@/lib/user-locale";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ShopBrand } from "@/components/shop-brand";

type Props = {
  unreadMessages: number;
  unreadComments: number;
  urgentCount: number;
  conversations: InboxConversation[];
  comments: InboxComment[];
  userId?: string;
};

function previewTitle(
  c: InboxConversation,
  myId: string | undefined,
) {
  if (!myId) return c.shop.name;
  return c.buyer.id === myId ? c.shop.name : c.buyer.name;
}

export function NotificationsBell({
  unreadMessages,
  unreadComments,
  urgentCount,
  conversations,
  comments,
  userId,
}: Props) {
  const seenStorageKey = userId ? `ss:notices:seen:${userId}` : null;
  const [notices, setNotices] = useState<
    { id: string; title: string; body: string; href: string | null; readAt: string | null }[]
  >([]);
  const [seenNoticeIds, setSeenNoticeIds] = useState<string[]>([]);
  const visibleNotices = notices.filter((n) => !seenNoticeIds.includes(n.id));
  const unreadNotices = visibleNotices.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (!seenStorageKey || typeof window === "undefined") {
      setSeenNoticeIds([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(seenStorageKey);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setSeenNoticeIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSeenNoticeIds([]);
    }
  }, [seenStorageKey]);

  function markNoticeSeen(id: string) {
    setSeenNoticeIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      if (seenStorageKey && typeof window !== "undefined") {
        try {
          window.localStorage.setItem(seenStorageKey, JSON.stringify(next));
        } catch {
          // ignore storage write failure
        }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!userId) return;
    const refreshNotices = () => {
      fetch("/api/notices")
        .then((r) => r.json())
        .then((json) => setNotices(json.notices ?? []))
        .catch(() => undefined);
    };
    refreshNotices();
    const timer = setInterval(refreshNotices, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        refreshNotices();
      }
    };
    const onFocus = () => refreshNotices();
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId]);
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"messages" | "comments">("messages");
  const messagesTabUnread = unreadMessages + unreadNotices;
  const combined = unreadMessages + unreadComments + unreadNotices;
  const badge = urgentCount > 0 ? urgentCount : combined;
  const hasBadge = urgentCount > 0 || combined > 0;

  const recent = conversations.slice(0, 12);

  async function openCommentsTab() {
    setTab("comments");
    const unreadIds = comments.filter((c) => c.unread).map((c) => c.id);
    if (!unreadIds.length) return;
    notifyInboxSeen({ commentIds: unreadIds });
    await fetchJson("/api/comments/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentIds: unreadIds }),
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        type="button"
        className="relative grid size-9 place-items-center rounded-full border border-border bg-muted/50 text-foreground"
        aria-label={t("nav.notifications")}
      >
        <Bell className="size-4" />
        {hasBadge && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold shadow",
              urgentCount > 0
                ? "bg-amber-500 text-black"
                : "bg-primary text-white",
            )}
          >
            {urgentCount > 0 ? (
              <AlertTriangle className="size-2.5" />
            ) : badge > 9 ? (
              "9+"
            ) : (
              badge
            )}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-4 py-3 text-left">
          <SheetTitle className="pr-8 font-heading text-base">
            {t("notifications.title")}
          </SheetTitle>
          <p className="text-[11px] text-muted-foreground">
            {t("notifications.commentsHint")}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setTab("messages")}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                tab === "messages"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t("notifications.tabMessages")}
              {messagesTabUnread > 0 ? ` · ${messagesTabUnread}` : ""}
            </button>
            <button
              type="button"
              onClick={() => void openCommentsTab()}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                tab === "comments"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t("notifications.tabComments")}
              {unreadComments > 0 ? ` · ${unreadComments}` : ""}
            </button>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "messages" ? (
            recent.length === 0 && visibleNotices.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                {t("notifications.empty")}
              </p>
            ) : (
              <ul>
                {visibleNotices.slice(0, 8).map((n) => (
                  <li key={n.id} className="border-b border-border">
                    <button
                      type="button"
                      className="flex w-full flex-col items-start px-4 py-3 text-left hover:bg-muted/50"
                      onClick={() => {
                        markNoticeSeen(n.id);
                        if (!n.id.startsWith("order-")) {
                          void fetchJson("/api/notices", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ ids: [n.id] }),
                          });
                        }
                        setNotices((prev) =>
                          prev.map((x) =>
                            x.id === n.id
                              ? { ...x, readAt: new Date().toISOString() }
                              : x,
                          ),
                        );
                        setOpen(false);
                        if (n.href) router.push(n.href);
                      }}
                    >
                      <span className="inline-flex items-center gap-1 text-sm font-bold">
                        {!n.readAt ? (
                          <span className="size-1.5 rounded-full bg-primary" />
                        ) : null}
                        {n.title}
                      </span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    </button>
                  </li>
                ))}
                {recent.map((c) => {
                  const last = c.messages[0];
                  const title = previewTitle(c, userId);
                  const urgent = Boolean(c.urgentPending);
                  const unread = (c.unreadCount ?? 0) > 0;
                  const isBuyer = userId === c.buyer.id;
                  return (
                    <li key={c.id} className="border-b border-border">
                      <button
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/50",
                          unread && !urgent && "bg-primary/5",
                          urgent && "bg-amber-500/10",
                        )}
                        onClick={() => {
                          notifyInboxSeen({ conversationId: c.id });
                          setOpen(false);
                          router.push(`/messages/${c.id}`);
                        }}
                      >
                        {isBuyer ? (
                          <ShopBrand
                            name={c.shop.name}
                            logoUrl={c.shop.logoUrl}
                            showAt={false}
                            className="mt-0.5"
                            avatarClassName="size-9 ring-1 ring-border"
                            nameClassName="sr-only"
                          />
                        ) : (
                          <span
                            className={cn(
                              "mt-0.5 grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border",
                              urgent
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-600"
                                : unread
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-muted/40 text-muted-foreground",
                            )}
                          >
                            {c.buyer.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.buyer.image}
                                alt=""
                                className="size-full object-cover"
                              />
                            ) : urgent ? (
                              <AlertTriangle className="size-4" />
                            ) : (
                              <MessageCircle className="size-4" />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span
                              className={cn(
                                "truncate text-sm",
                                unread || urgent
                                  ? "font-bold"
                                  : "font-semibold",
                              )}
                            >
                              {title}
                            </span>
                            {urgent && (
                              <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-black">
                                {t("messages.urgent")}
                              </span>
                            )}
                            {unread && !urgent && (
                              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                                {(c.unreadCount ?? 0) > 9
                                  ? "9+"
                                  : c.unreadCount}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {last?.body || t("notifications.noPreview")}
                          </span>
                          {last?.createdAt && (
                            <span className="mt-1 block text-[10px] text-muted-foreground/80">
                              {new Date(last.createdAt).toLocaleString(
                                intlLocaleFromUserLocale(locale),
                                {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : comments.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("notifications.commentsEmpty")}
            </p>
          ) : (
            <ul>
              {comments.map((c) => (
                <li key={c.id} className="border-b border-border">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted/50",
                      c.unread && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (c.unread) {
                        notifyInboxSeen({ commentIds: [c.id] });
                        void fetchJson("/api/comments/read", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ commentIds: [c.id] }),
                        });
                      }
                      setOpen(false);
                      router.push(`/product/${c.product.id}?comments=1`);
                    }}
                  >
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                      {c.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.user.image}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        c.user.name.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {c.user.name}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {c.body}
                      </span>
                      <span className="mt-1 block truncate text-[10px] text-primary">
                        {c.product.title}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border p-3">
          <Link
            href={tab === "comments" ? "/" : "/messages"}
            onClick={() => setOpen(false)}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            {tab === "comments"
              ? t("feed.tabForYou")
              : t("notifications.seeAll")}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Variante autonome (si besoin hors shell). */
export function NotificationsBellConnected() {
  const { data: session } = authClient.useSession();
  const inbox = useInboxUnread(session?.user?.id);

  if (!session?.user?.id) {
    return (
      <Link
        href="/auth/login"
        className="relative grid size-9 place-items-center rounded-full border border-border bg-muted/50 text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
      </Link>
    );
  }

  return (
    <NotificationsBell
      userId={session.user.id}
      unreadMessages={inbox.unreadMessages}
      unreadComments={inbox.unreadComments}
      urgentCount={inbox.urgentCount}
      conversations={inbox.conversations}
      comments={inbox.comments}
    />
  );
}
