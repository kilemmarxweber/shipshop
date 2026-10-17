export const DEFAULT_APP_NAME = "ShipShop";

export function getAppName() {
  const name =
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    process.env.APP_NAME?.trim();
  return name || DEFAULT_APP_NAME;
}

export function getAppInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}
