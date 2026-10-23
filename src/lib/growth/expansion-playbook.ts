export type ExpansionWave = {
  id: string;
  title: string;
  weeks: string;
  cities: string[];
  languages: string[];
  partnerFocus: string[];
  launchChecklist: string[];
};

export const EXPANSION_PLAYBOOK: ExpansionWave[] = [
  {
    id: "wave-a",
    title: "Kinshasa + villes satellites",
    weeks: "S1–S6",
    cities: ["Kinshasa", "Kongo Central"],
    languages: ["fr", "ln"],
    partnerFocus: ["Telecom", "Mobile money", "Mode locale"],
    launchChecklist: [
      "Activer Badge Actif + KPI attention",
      "Lancer 2 formats feed (challenge + story)",
      "Recruter 20 créateurs pilotes",
      "Lancer un pack Discovery pour 3 marques locales",
    ],
  },
  {
    id: "wave-b",
    title: "RDC intérieure",
    weeks: "S7–S14",
    cities: ["Lubumbashi", "Goma", "Kisangani"],
    languages: ["fr", "sw"],
    partnerFocus: ["Électronique", "Beauté", "Livraison locale"],
    launchChecklist: [
      "Ouvrir Badge Influenceur (2k+) en beta",
      "Activer live + cadeaux sur groupe pilote",
      "Localiser visuels et tendances ville",
      "Former 1 partenaire pub par ville",
    ],
  },
  {
    id: "wave-c",
    title: "Afrique centrale / ouest",
    weeks: "S15–S24",
    cities: ["Brazzaville", "Libreville", "Abidjan", "Dakar"],
    languages: ["fr", "en"],
    partnerFocus: ["FMCG", "Finance", "Divertissement"],
    launchChecklist: [
      "Self-serve campagnes Discovery / Engagement / Conversion",
      "Templates campagne régionaux",
      "Modération + anti-fraude 24/7",
      "Calendrier cultural moments (fêtes, sport, rentrée)",
    ],
  },
  {
    id: "wave-d",
    title: "Spotlight mondial",
    weeks: "S25+",
    cities: ["Lisboa", "Paris", "Bruxelles", "Luanda"],
    languages: ["fr", "en", "pt"],
    partnerFocus: ["Diaspora", "Marques globales", "Créateurs cross-border"],
    launchChecklist: [
      "Global spotlight feed",
      "Paiements multi-devises",
      "Programme partenaires régionaux",
      "Playbook localisation culturelle (ton, visuels, prix)",
    ],
  },
];

export function expansionSummary() {
  return {
    approach: "city-by-city puis extension régionale",
    localesReady: ["fr", "en", "pt"],
    waves: EXPANSION_PLAYBOOK,
  };
}
