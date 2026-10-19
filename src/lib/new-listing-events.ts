import { clearAllFeedListCaches } from "@/lib/feed-list-cache";

export const NEW_LISTING_EVENT = "chipshop:new-listing";
export const NEW_LISTING_STORAGE_KEY = "chipshop.newListing.v1";

export type NewListingFlashPayload = {
  id: string;
  title: string;
  priceCents: number;
  currency?: string;
  createdAt?: string;
  cover: string | null;
  shop: {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    ownerUserId?: string | null;
  };
};

export function notifyNewListing(payload: NewListingFlashPayload) {
  if (typeof window === "undefined") return;
  clearAllFeedListCaches();
  window.dispatchEvent(new CustomEvent(NEW_LISTING_EVENT, { detail: payload }));
  try {
    localStorage.setItem(
      NEW_LISTING_STORAGE_KEY,
      JSON.stringify({ ...payload, t: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}
