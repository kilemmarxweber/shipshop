# TERMES DE RÉFÉRENCE (TDR)
## Programme ShipRewards — récompense des vendeurs ShipShop

**Version :** 1.0  
**Statut :** Politique opérationnelle  
**Public :** vendeurs (boutiques) utilisant exclusivement les outils promotionnels ShipShop

## 1. Objet

Mettre en place un programme qui transforme chaque réduction créée dans ShipShop en investissement : visibilité, ventes, fidélisation, et compensation partielle (ShipCash + ShipPoints), tout en préservant la rentabilité vendeur et la confiance acheteur.

Slogan : *Sur ShipShop, vos réductions ne sont pas une perte. Elles deviennent un investissement qui génère davantage de clients, de visibilité et de ventes.*

## 2. Objectifs

- Augmenter le nombre de promotions **authentiques** sur la plateforme.
- Améliorer l’attractivité des offres (prix barré / prix promo).
- Stimuler les ventes et la fidélisation.
- Encourager l’usage exclusif des outils promo ShipShop.

## 3. Périmètre

### Inclus

- Promotions en **pourcentage** (période datée ou définitive).
- Affichage acheteur : ancien prix **barré rouge**, nouveau prix **vert**, badge −%.
- Barème ShipPoints, badges de palier, boosts de visibilité.
- ShipCash = 10 % de la réduction **sur ventes réceptionnées**.
- Réductions de commission (Standard / Platinum).
- Politique d’utilisation vendeur, aide, confidentialité explicative.

### Exclu (v2)

- Cashback acheteur.
- Événements commerciaux Legend hors calendrier produit.
- Promos multi-produits « panier » et codes promo saisis à la caisse.

## 4. Barème ShipRewards

Le palier est le **pourcentage entier** `(compareAt − prix) / compareAt`, arrondi à l’inférieur.

| Palier | Remise | ShipPoints (activation) | Visibilité |
| --- | --- | --- | --- |
| Hors barème | 1–4 % | 0 | Affichage prix uniquement |
| Promo Light | 5–9 % | 50 | Badge « Offre du Moment » + boost +10 % / 48 h |
| Promo Standard | 10–14 % | 120 | Mise en avant catégorie + −1 % commission sur 10 ventes suivantes |
| Promo Forte | 15–19 % | 250 | Boost gratuit 3 jours + rubrique Meilleures offres |
| Promo Flash | ≥ 20 % | 500 | Badge Flash Deal + home (quota) + classement hebdo |

Plafond de remise affichable : 70 %. Au-delà, la promo est **signalée** à la modération et n’ouvre pas les récompenses tant qu’elle n’est pas validée.

## 5. Prix de référence et anti-faux-prix

- Le prix barré (`compareAtCents`) est le prix **avant** la promo ShipShop.
- Il doit correspondre à un prix **affiché ou vendu pendant au moins 14 jours** (historique `ProductPriceHistory`).
- Un simple PATCH de `priceCents` **sans** fiche promo n’ouvre aucune récompense.
- Une seule promo **ACTIVE** par produit.
- Auto-achat (acheteur = propriétaire boutique) : pas de ShipCash ni de points de vente.

## 6. Durée

- **Période** : `startsAt` / `endsAt`, durée minimale 1 heure.
- **Définitif** : `endsAt` null, jusqu’à désactivation manuelle.
- Flash en définitif : éligible points/cash ; la home n’est pas pinnée éternellement (quota 3 Flash / boutique / semaine, boost borné).

## 7. ShipCash

- 10 % de `(compareAt − prix payé)` **par unité vendue et réception confirmée**.
- Crédité sur le wallet vendeur (`vendorUsdCents`), libellé ShipCash, retirable selon KYC.
- Promo retirée avant la vente : pas de cashback.
- Annulation / remboursement / fraude : clawback du ShipCash et des points de **cette** vente.

## 8. Niveaux (cumul de ShipPoints boutique)

| Statut | Points | Avantages |
| --- | --- | --- |
| Bronze | 0–999 | Accès au programme |
| Silver | 1 000–4 999 | Badge vendeur vérifié ShipRewards + 5 % visibilité |
| Gold | 5 000–19 999 | Priorité recherche + campagnes spéciales |
| Platinum | 20 000–49 999 | −50 bps commission permanente + reco produits |
| Legend | 50 000+ | Home régulière (slots rotatifs) + événements exclusifs |

## 9. Commission Standard

−100 bps (−1 point) sur les **10 prochaines ventes** de la boutique après activation d’une Promo Standard, appliqué **après** le palier volume (`saleFeeBpsForMonthlyGmvUsd`). Non empilable avec une 2e Standard tant que le quota n’est pas épuisé.

## 10. Politique d’utilisation (vendeur)

Le vendeur s’engage à :

1. N’utiliser que l’outil Réduction ShipShop pour ouvrir des récompenses.
2. Ne pas gonfler un prix pour simuler une remise.
3. Honorer le prix vert affiché jusqu’à la fin de la promo.
4. Accepter clawback, KYC et conservation des journaux promo.

Le non-respect peut entraîner la suspension du programme, sans préjudice des CGU.

## 11. Données et confidentialité

Les classements « meilleures offres » exposent le nom boutique, le % et le volume promo agrégé. Les soldes ShipPoints / ShipCash ne sont pas publics. Détail : `CONFIDENTIALITE.md`.

## 12. Fiscalité

ShipCash est un crédit commercial interne. Le vendeur reste responsable de ses obligations fiscales locales. ShipShop ne fournit pas de conseil fiscal.
