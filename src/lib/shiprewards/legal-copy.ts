export type LegalSection = { title: string; body: string[] };

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    title: "Compte",
    body: [
      "Nous conservons identifiant, nom, téléphone / e-mail, langue, thème, et éventuellement documents KYC vendeur.",
      "Objectif : vous connecter, sécuriser le compte, payer et livrer.",
    ],
  },
  {
    title: "Commandes et portefeuille",
    body: [
      "Montants, statut, adresse de livraison, mouvements wallet (achats, retraits, ShipCash).",
      "Objectif : exécuter la vente, lutter contre la fraude, calculer commissions et récompenses. Ces journaux ne sont pas affichés aux autres acheteurs.",
    ],
  },
  {
    title: "Promotions ShipRewards",
    body: [
      "Pour une promo : produit, pourcentage, dates, prix avant / après, palier. Pour les points : solde boutique et historique de crédits.",
      "Public : nom de boutique, titre produit, ancien/nouveau prix, % de remise, badge palier.",
      "Privé : solde ShipPoints, ShipCash, quotas commission, raisons de clawback.",
    ],
  },
  {
    title: "Classements",
    body: [
      "Le classement hebdomadaire des meilleures offres agrège des volumes de ventes en promo. Il n’affiche pas l’identité des acheteurs.",
    ],
  },
  {
    title: "Cookies et appareil",
    body: [
      "Session, langue, thème, déverrouillage son du feed. Pas de revente de listes d’acheteurs à des annonceurs tiers dans le cadre de ce programme.",
    ],
  },
  {
    title: "Conservation et droits",
    body: [
      "Commandes et ledger financier : durée nécessaire au service, aux litiges et aux obligations comptables.",
      "Vous pouvez demander l’accès ou la correction de vos données de profil via l’application. La suppression de compte suit les CGU.",
    ],
  },
];

export const CGU_SECTIONS: LegalSection[] = [
  {
    title: "Objet",
    body: [
      "ShipShop est une marketplace. Les vendeurs publient des produits, les acheteurs paient via le portefeuille, l’argent est libéré à la réception.",
      "Le programme ShipRewards récompense les réductions créées dans l’application, selon la politique vendeur.",
    ],
  },
  {
    title: "Prix et promotions",
    body: [
      "Le prix vert affiché est le prix facturé. L’ancien prix barré n’est jamais débité.",
      "Seules les promotions créées via l’outil Réduction ouvrent des récompenses. Un simple changement de prix n’en ouvre pas.",
    ],
  },
  {
    title: "Abus",
    body: [
      "Faux rabais, auto-achat et fraudes entraînent clawback, suspension de promo ou du compte, selon gravité.",
    ],
  },
];

export const HELP_VENDOR_INDEX: LegalSection[] = [
  {
    title: "Boutique",
    body: [
      "Publiez un produit, gérez stock et prix, suivez les commandes et le QR de remise.",
      "Le client paie d’abord ; vous êtes crédité à la confirmation de réception.",
    ],
  },
  {
    title: "ShipRewards",
    body: [
      "Baissez un prix via l’outil Réduction : vous gagnez des points, de la visibilité, et du ShipCash à la livraison.",
      "Les réductions hors application ne comptent pas.",
    ],
  },
];

export const HELP_SHIPREWARDS: LegalSection[] = [
  {
    title: "Comment créer une promo",
    body: [
      "Ouvrez un produit que vous gérez → section Réduction → pourcentage → Période ou Définitif → activer.",
      "Moins de 5 % : le prix s’affiche, sans ShipPoints ni ShipCash.",
    ],
  },
  {
    title: "Barème",
    body: [
      "Light 5–9 % · Standard 10–14 % · Forte 15–19 % · Flash ≥ 20 %.",
      "ShipCash = 10 % de la réduction, uniquement quand le client confirme la réception.",
      "Exemple : 100 $ → −20 $ ; le client paie 80 $ ; vous recevez 2 $ ShipCash à la réception.",
    ],
  },
  {
    title: "Interdit",
    body: [
      "Gonfler le prix puis afficher −20 %. Vendre à votre propre compte. Promettre un autre prix que le prix vert.",
    ],
  },
  {
    title: "Clawback",
    body: [
      "Commande annulée, remboursée ou fraude : ShipShop reprend le ShipCash et les points liés à cette vente.",
    ],
  },
  {
    title: "Cashback acheteur",
    body: ["À venir. Pas dans cette version."],
  },
];
