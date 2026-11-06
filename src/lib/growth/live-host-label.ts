/**
 * Affichage hôte live (alerte + cards feed/Discover) :
 * — boutique présente → « Boutique · Nom »
 * — sinon (artiste / admin / owner / créateur) → nom seul
 */
export type LiveHostKind = "OWNER" | "ADMIN" | "INFLUENCER" | "CREATOR";

export function formatLiveHostLabel(input: {
  userName?: string | null;
  shopName?: string | null;
  hostLabel?: string | null;
}): string {
  if (input.hostLabel?.trim()) return input.hostLabel.trim();
  const name = (input.userName ?? "").trim() || "Créateur";
  const shop = (input.shopName ?? "").trim();
  if (shop && shop.toLowerCase() !== name.toLowerCase()) {
    return `${shop} · ${name}`;
  }
  if (shop) return shop;
  return name;
}

export function liveHostKindFromFlags(input: {
  isPlatformOwner?: boolean;
  isPlatformAdmin?: boolean;
  isInfluencer?: boolean;
}): LiveHostKind {
  if (input.isPlatformOwner) return "OWNER";
  if (input.isPlatformAdmin) return "ADMIN";
  if (input.isInfluencer) return "INFLUENCER";
  return "CREATOR";
}
