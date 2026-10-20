"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";
import {
  INBOX_SEEN_EVENT,
  INBOX_UPDATED_EVENT,
  type InboxSeenDetail,
} from "@/lib/inbox-events";

export type InboxConversation = {
  id: string;
  updatedAt: string;
  urgentPending?: boolean;
  unreadCount?: number;
  shop: { id: string; name: string; logoUrl?: string | null };
  product: { id: string; title: string; images: string[] } | null;
  buyer: { id: string; name: string; image?: string | null };
  messages: {
    body: string;
    createdAt: string;
    senderId: string;
    isUrgent?: boolean;
    requiresAck?: boolean;
  }[];
};

export type InboxComment = {
  id: string;
  body: string;
  createdAt: string;
  unread: boolean;
  user: { id: string; name: string; image: string | null };
  product: {
    id: string;
    title: string;
    images: string[];
    shop: { id: string; name: string; logoUrl: string | null };
  };
};

const POLL_MS = 25_000;

export function useInboxUnread(userId: string | undefined, pathname?: string) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [comments, setComments] = useState<InboxComment[]>([]);
  const [unreadComments, setUnreadComments] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) {
        setConversations([]);
        setComments([]);
        setUnreadComments(0);
        return;
      }
      if (!opts?.silent) setLoading(true);
      try {
        const [{ data }, commentsRes] = await Promise.all([
          fetchJson<{
            conversations?: InboxConversation[];
          }>("/api/conversations"),
          fetchJson<{
            unreadComments?: number;
            comments?: InboxComment[];
          }>("/api/inbox/summary"),
        ]);
        setComments(commentsRes.data?.comments ?? []);
        setUnreadComments(commentsRes.data?.unreadComments ?? 0);
        const list = data?.conversations ?? [];
        list.sort((a, b) => {
          const au = a.urgentPending ? 2 : (a.unreadCount ?? 0) > 0 ? 1 : 0;
          const bu = b.urgentPending ? 2 : (b.unreadCount ?? 0) > 0 ? 1 : 0;
          if (au !== bu) return bu - au;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
        setConversations(list);
      } catch {
        /* keep previous */
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setComments([]);
      setUnreadComments(0);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [userId, refresh]);

  useEffect(() => {
    function applySeen(detail: InboxSeenDetail) {
      if (detail.conversationId) {
        const id = detail.conversationId;
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== id) return c;
            if (c.urgentPending) return c;
            return { ...c, unreadCount: 0 };
          }),
        );
      }
      if (detail.commentIds?.length) {
        const ids = new Set(detail.commentIds);
        setComments((prev) => {
          let dropped = 0;
          const next = prev.map((c) => {
            if (!ids.has(c.id) || !c.unread) return c;
            dropped += 1;
            return { ...c, unread: false };
          });
          if (dropped) {
            setUnreadComments((n) => Math.max(0, n - dropped));
          }
          return next;
        });
      } else if (detail.productId) {
        const productId = detail.productId;
        setComments((prev) => {
          const hit = prev.filter((c) => c.unread && c.product.id === productId);
          if (hit.length) {
            setUnreadComments((n) => Math.max(0, n - hit.length));
          }
          return prev.map((c) =>
            c.product.id === productId ? { ...c, unread: false } : c,
          );
        });
      }
      window.setTimeout(() => {
        void refresh({ silent: true });
      }, 350);
    }

    function onSeen(event: Event) {
      const detail = (event as CustomEvent<InboxSeenDetail>).detail ?? {};
      applySeen(detail);
    }

    window.addEventListener(INBOX_SEEN_EVENT, onSeen);
    const onUpdated = () => {
      void refresh({ silent: true });
    };
    window.addEventListener(INBOX_UPDATED_EVENT, onUpdated);
    return () => {
      window.removeEventListener(INBOX_SEEN_EVENT, onSeen);
      window.removeEventListener(INBOX_UPDATED_EVENT, onUpdated);
    };
  }, [refresh]);

  useEffect(() => {
    const match = pathname?.match(/^\/messages\/([^/?]+)$/);
    if (!match?.[1] || !userId) return;
    const id = match[1];
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.urgentPending) return c;
        return { ...c, unreadCount: 0 };
      }),
    );
    const timer = window.setTimeout(() => {
      void refresh({ silent: true });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pathname, userId, refresh]);

  const unreadMessages = conversations.reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );
  const urgentCount = conversations.filter((c) => c.urgentPending).length;

  return {
    conversations,
    comments,
    unreadMessages,
    unreadComments,
    urgentCount,
    loading,
    refresh,
  };
}
