import { clearFeedListCache } from "@/lib/feed-list-cache";

export const WANTED_LIST_CACHE_KEY = "wanted:open";
export const WANTED_UPDATED_EVENT = "chipshop:wanted-updated";
export const WANTED_UPDATED_STORAGE_KEY = "chipshop.wantedUpdated.v1";
export const OPEN_WANTED_TAB_KEY = "chipshop.openWantedTab";
export const WANTED_FLASH_KEY = "chipshop.wantedFlashId";

let pending: { requestId: string; at: number } | null = null;

/** Lue au montage de l’accueil, sans effacer (le strict mode remonte la page). */
export function peekWantedNavigation() {
  if (pending && Date.now() - pending.at < 8000) return pending;
  if (typeof sessionStorage === "undefined") return null;
  try {
    if (sessionStorage.getItem(OPEN_WANTED_TAB_KEY) !== "1") return null;
    const requestId = sessionStorage.getItem(WANTED_FLASH_KEY);
    if (!requestId) return null;
    return { requestId, at: Date.now() };
  } catch {
    return null;
  }
}

/** Vide le cache Je cherche et prévient les autres onglets du même navigateur. */
export function notifyWantedUpdated(requestId: string) {
  if (typeof window === "undefined") return;
  pending = { requestId, at: Date.now() };
  clearFeedListCache(WANTED_LIST_CACHE_KEY);
  try {
    sessionStorage.setItem(OPEN_WANTED_TAB_KEY, "1");
    sessionStorage.setItem(WANTED_FLASH_KEY, requestId);
    localStorage.setItem(
      WANTED_UPDATED_STORAGE_KEY,
      JSON.stringify({ requestId, t: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(
    new CustomEvent(WANTED_UPDATED_EVENT, { detail: { requestId } }),
  );
  window.setTimeout(() => {
    if (pending?.requestId === requestId) pending = null;
    try {
      sessionStorage.removeItem(OPEN_WANTED_TAB_KEY);
      sessionStorage.removeItem(WANTED_FLASH_KEY);
    } catch {
      /* private mode */
    }
  }, 8000);
}
