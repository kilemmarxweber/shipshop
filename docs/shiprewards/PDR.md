# PDR — ShipRewards (plan de réalisation / capability)

**Version :** 1.0  
**Lié à :** [TDR.md](./TDR.md)

## 1. Capability

Après livraison, un vendeur peut **créer une réduction en %** (période ou définitive) sur un produit ; l’acheteur voit **prix barré rouge + prix vert** ; la plateforme crédite **ShipPoints / visibilité à l’activation** et **ShipCash à la réception**, de façon **idempotente**.

## 2. Invariants

- Le checkout facture uniquement `priceCents` (prix vert).
- `compareAtCents` ≥ `priceCents` quand une promo est ACTIVE.
- Une promo ACTIVE max par produit.
- Grants (points activation, cashback vente, clawback) : au plus une fois par `(promoId, reason)` ou `(orderId, reason)`.
- Remise &lt; 5 % : affichage seulement, zéro récompense.

## 3. Données

- `Product.compareAtCents`, `Product.promoId`
- `ProductPromo` (percent, tier, startsAt, endsAt nullable, status, compareAtSnapshot)
- `ProductPriceHistory`
- `ShipPointLedger`
- `ShopRewardState`
- `WalletTxnType.SHIPCASH_REWARD` / `SHIPCASH_CLAWBACK`
- `ShopBoost.source` (`PAID` | `SHIPREWARDS`)

## 4. Événements

1. **Promo activée** (valide) → points palier + boost/badge + éventuellement grant commission 10 ventes.
2. **Vente réceptionnée** (`releaseEscrowToSeller`) → ShipCash 10 % de la remise unitaire × quantité (1 ligne commande = 1 unité aujourd’hui).
3. **Promo expirée / stop** → restauration du prix de référence si le prix courant est encore le prix promo.
4. **Remboursement / annulation post-crédit** → clawback.

## 5. APIs

- `POST /api/products/:id/promo` — créer / activer
- `DELETE /api/products/:id/promo` — arrêter
- `GET /api/shops/:id/rewards` — tableau de bord vendeur
- `GET /api/products?bestOffers=1` — Meilleures offres

## 6. UI

- Vendeur : bloc Réduction (commerce tools + fiche produit).
- Acheteur : `ProductPriceTag` (feed, shop, fiche, panier, sheet).
- Profil : liens Confidentialité, Aide vendeur, ShipRewards, CGU.
- `/shops/rewards` : palier, points, ShipCash du mois.

## 7. Phases

1. Docs + pages légales/aide (fait dans cette livraison).
2. Schéma + moteur promo + prix + grants de base.
3. Ranking feed / meilleures offres / dashboard.
4. v2 : campagnes Gold, événements Legend, cashback acheteur.

## 8. Risques et rollback

- Faux rabais → historique 14 j obligatoire.
- Double crédit → unique ledger + types wallet.
- Coût plateforme → journaliser GMV promo vs ShipCash.
- Rollback schéma : colonnes nullable ; désactiver routes promo suffit pour stopper les grants.
