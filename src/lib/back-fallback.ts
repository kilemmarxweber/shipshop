/** Fallback quand il n’y a pas d’historique in-app (deep link, refresh, nouvel onglet). */
export function defaultBackFallback(pathname: string): string {
  if (pathname.startsWith("/shops/")) return "/shops";
  if (pathname === "/shops") return "/profile";
  if (pathname.startsWith("/shop/")) return "/";
  if (pathname.startsWith("/messages/")) return "/messages";
  if (pathname.startsWith("/orders/")) return "/profile";
  if (pathname.startsWith("/wanted/new")) return "/publish";
  if (pathname.startsWith("/wanted/")) return "/wanted";
  if (pathname === "/wanted") return "/";
  if (pathname.startsWith("/product/")) return "/";
  if (pathname.startsWith("/auth/register")) return "/auth/login";
  if (pathname.startsWith("/auth/")) return "/";
  if (pathname.startsWith("/onboarding")) return "/";
  if (pathname === "/kyc" || pathname.startsWith("/kyc/")) return "/profile";
  if (pathname === "/wallet") return "/profile";
  if (pathname === "/profile") return "/";
  return "/";
}
