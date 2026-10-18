export const INBOX_SEEN_EVENT = "inbox-seen";

export type InboxSeenDetail = {
  conversationId?: string;
  commentIds?: string[];
  productId?: string;
};

/** Badge cloche : décrémente tout de suite, puis refetch serveur. */
export function notifyInboxSeen(detail: InboxSeenDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<InboxSeenDetail>(INBOX_SEEN_EVENT, { detail }));
}
