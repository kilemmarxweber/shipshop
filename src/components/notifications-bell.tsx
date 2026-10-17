"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import {
  useInboxUnread,
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

type Props = {
  unreadMessages: number;
  urgentCount: number;
  conversations: InboxConversation[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpenConversation: (id: string) => void;
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
  urgentCount,
  conversations,
  refreshing,
  onRefresh,
  onOpenConversation,
  userId,
}: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const badge = urgentCount > 0 ? urgentCount : unreadMessages;
  const hasBadge = urgentCount > 0 || unreadMessages > 0;

  const recent = conversations.slice(0, 12);

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
          <div className="flex items-center justify-between gap-2 pr-8">
            <SheetTitle className="font-heading text-base">
              {t("notifications.title")}
            </SheetTitle>
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={refreshing}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold transition hover:bg-muted disabled:opacity-50"
              aria-label={t("notifications.refresh")}
            >
              <RefreshCw
                className={cn("size-3.5", refreshing && "animate-spin")}
              />
              {t("notifications.refresh")}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("notifications.hint")}
          </p>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {recent.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul>
              {recent.map((c) => {
                const last = c.messages[0];
                const title = previewTitle(c, userId);
                const urgent = Boolean(c.urgentPending);
                const unread = (c.unreadCount ?? 0) > 0;
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
                        onOpenConversation(c.id);
                        setOpen(false);
                        router.push(`/messages/${c.id}`);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full border",
                          urgent
                            ? "border-amber-500/40 bg-amber-500/15 text-amber-600"
                            : unread
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border bg-muted/40 text-muted-foreground",
                        )}
                      >
                        {urgent ? (
                          <AlertTriangle className="size-4" />
                        ) : (
                          <MessageCircle className="size-4" />
                        )}
                      </span>
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
          )}
        </div>

        <div className="border-t border-border p-3">
          <Link
            href="/messages"
            onClick={() => setOpen(false)}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            {t("notifications.seeAll")}
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
      urgentCount={inbox.urgentCount}
      conversations={inbox.conversations}
      refreshing={inbox.refreshing}
      onRefresh={() => void inbox.refresh({ silent: true })}
      onOpenConversation={inbox.markConversationSeen}
    />
  );
}
