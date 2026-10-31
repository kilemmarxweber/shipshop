import { LegalArticle } from "@/components/legal-article";
import { CGU_SECTIONS } from "@/lib/shiprewards/legal-copy";

export default function TermsPage() {
  return (
    <LegalArticle
      title="Conditions d’usage"
      intro="En utilisant ShipShop, vous acceptez ces règles. Le programme ShipRewards s’applique aux vendeurs qui créent une réduction dans l’application."
      sections={CGU_SECTIONS}
    />
  );
}
