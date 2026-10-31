import { LegalArticle } from "@/components/legal-article";
import { PRIVACY_SECTIONS } from "@/lib/shiprewards/legal-copy";

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Confidentialité"
      intro="Ce texte décrit quelles données nous utilisons, pourquoi, et ce qui est public. Ce n’est pas un substitut aux obligations légales locales ; c’est le mode d’emploi lisible."
      sections={PRIVACY_SECTIONS}
    />
  );
}
