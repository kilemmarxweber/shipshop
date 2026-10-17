"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetch-json";

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

const POLL_MS = 25_000;

export function useInboxUnread(userId: string | undefined, pathname?: string) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!userId) {
        setConversations([]);
        return;
      }
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      try {
        const { data } = await fetchJson<{
          conversations?: InboxConversation[];
        }>("/api/conversations");
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
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setConversations([]);
      return;
    }
    void refresh();
    const timer = window.setInterval(() => {
      void refresh({ silent: true });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [userId, pathname, refresh]);

  const unreadMessages = conversations.reduce(
    (sum, c) => sum + (c.unreadCount ?? 0),
    0,
  );
  const urgentCount = conversations.filter((c) => c.urgentPending).length;

  /** Optimistic : après clic, décrémente le badge (sauf urgence à acquitter). */
  function markConversationSeen(id: string) {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.urgentPending) return c;
        return { ...c, unreadCount: 0 };
      }),
    );
  }

  return {
    conversations,
    unreadMessages,
    urgentCount,
    loading,
    refreshing,
    refresh,
    markConversationSeen,
  };
}
