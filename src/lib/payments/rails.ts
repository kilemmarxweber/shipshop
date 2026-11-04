/**
 * Rails argent ShipShop
 *
 * - Achat / panier : solde interne uniquement (provider INTERNAL).
 *   CinetPay n'est jamais appelé.
 * - Dépôt (recharge) : CinetPay collection.
 * - Retrait : CinetPay transfert vers le numéro Mobile Money.
 */

export const PURCHASE_PROVIDER = "INTERNAL" as const;

export type CinetPayRail = "DEPOSIT" | "WITHDRAW";

export const CINETPAY_RAILS: readonly CinetPayRail[] = ["DEPOSIT", "WITHDRAW"];
