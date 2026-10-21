const KEY = "ss_creator";

export function rememberCreatorAttribution(userId: string | null | undefined) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.sessionStorage.setItem(KEY, userId);
  } catch {
    /* ignore */
  }
}

export function readCreatorAttribution() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
