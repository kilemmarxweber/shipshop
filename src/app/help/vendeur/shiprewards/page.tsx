import { LegalArticle } from "@/components/legal-article";
import { HELP_SHIPREWARDS } from "@/lib/shiprewards/legal-copy";

export default function ShipRewardsHelpPage() {
  return (
    <LegalArticle
      title="ShipRewards"
      intro="Les réductions créées dans ShipShop deviennent un investissement : points, visibilité, ShipCash à la réception. Cashback acheteur : à venir."
      sections={HELP_SHIPREWARDS}
    />
  );
}
