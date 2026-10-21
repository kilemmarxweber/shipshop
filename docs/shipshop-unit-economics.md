# ShipShop — unit economics (illustratif, pas des prévisions)

Ces scénarios servent à discuter le modèle. Ils **ne sont pas** des forecasts. Remplacer chaque hypothèse dès qu’il y a du GMV réel.

**Moteur :** GMV → take rate transactionnel (cible 5 %, paliers 5 → 3,5 %) + ShipBoost + ShipPro optionnel + pubs plus tard.

**Ne pas monétiser :** compte, feed, follow, like, commentaire, message, publish, recherche, ShipNeeds, live standard.

## Hypothèses communes (à infirmer)

- Panier moyen (AOV) : à mesurer (CA remis / commandes).
- Take rate transactionnel de départ : 5 % du produit, hors livraison / paiement.
- Boost et Pro : nuls en prudent, modestes ensuite.
- Publicité marques : 0 tant que l’attribution n’existe pas.

## Trois scénarios mensuels (mois 12, illustration)

### Prudent

- GMV : 20 000 $
- Take rate : 5 % → 1 000 $
- ShipBoost : 200 $
- ShipPro : 100 $ (10 vendeurs × 10 $)
- Ads : 0 $
- **Revenus ~ 1 300 $** · monetization / GMV ~ 6,5 %

### Réaliste

- GMV : 80 000 $
- Take rate : 4,7 % (mix paliers) → 3 760 $
- ShipBoost : 1 200 $
- ShipPro : 400 $
- Ads : 400 $
- **Revenus ~ 5 760 $** · ~ 7,2 % du GMV

### Croissance

- GMV : 250 000 $
- Take rate : 4,3 % → 10 750 $
- ShipBoost : 4 000 $
- ShipPro : 1 200 $
- Ads : 3 000 $
- **Revenus ~ 18 950 $** · ~ 7,6 % du GMV

## Projection 36 mois (cadre, pas un plan d’affaires)

| Mois | Question à trancher avec la data |
| --- | --- |
| 1–6 | GMV existe-t-il ? Conversion contenu → fiche → achat ? Wanted produit-il de l’intention ? |
| 7–18 | Les vendeurs paient-ils Boost sans y être forcés ? Les créateurs attribuent-ils des ventes ? |
| 19–36 | Pro et Ads seulement si DAU, qualité (refunds/litiges) et attribution tiennent |

Règle : **ne jamais présenter les montants du mémo 100 k$ / 8 k$ comme un objectif chiffré** avant mesure.

## KPI à suivre dans `/shops/reports`

- GMV (`soldCents`), panier moyen, take rate bps
- Funnel feed → fiche → achat
- Intention Wanted (catégorie, budget moyen)
- Qualité : remboursements, litiges, délais
