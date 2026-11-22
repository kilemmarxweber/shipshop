/** Internal path only. Blocks open redirects and auth loops. */
export function safeNextPath(raw: string | null | undefined) {
  if (!raw) return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "/";
  }
  if (path.includes("://") || path.startsWith("/auth")) return "/";
  return path;
}

export function loginHref(next: string) {
  return `/auth/login?next=${encodeURIComponent(safeNextPath(next))}`;
}
