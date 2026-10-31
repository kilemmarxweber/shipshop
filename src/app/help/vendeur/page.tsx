import Link from "next/link";
import { LegalArticle } from "@/components/legal-article";
import { HELP_VENDOR_INDEX } from "@/lib/shiprewards/legal-copy";

export default function VendorHelpPage() {
  return (
    <div>
      <LegalArticle
        title="Aide vendeur"
        intro="Guides courts pour vendre sur ShipShop. Le détail ShipRewards est dans le programme."
        sections={HELP_VENDOR_INDEX}
      />
      <div className="mx-auto mb-24 w-full max-w-2xl px-4">
        <Link
          href="/help/vendeur/shiprewards"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-white"
        >
          Programme ShipRewards
        </Link>
      </div>
    </div>
  );
}
