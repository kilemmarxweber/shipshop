/** Résout le lien d’une story partenaire — évite les 404 (produit mort, CTA mal formé). */

export function resolvePartnerStoryHref(story: {
  ctaUrl?: string | null;
  productId?: string | null;
}): { href: string; external: boolean } {
  const cta = (story.ctaUrl ?? "").trim();
  if (cta) {
    if (/^https?:\/\//i.test(cta)) {
      return { href: cta, external: true };
    }
    if (cta.startsWith("/")) {
      return { href: cta, external: false };
    }
    // ID produit collé sans slash → fiche produit
    if (/^[a-z0-9_-]{8,}$/i.test(cta) && !cta.includes(".")) {
      return { href: `/product/${cta}`, external: false };
    }
  }
  if (story.productId) {
    return { href: `/product/${story.productId}`, external: false };
  }
  return { href: "/discover", external: false };
}
