import type { MobileMoneyProvider } from "@/generated/prisma/client";

export type RailProvider = Exclude<MobileMoneyProvider, "INTERNAL">;

export const RAIL_PROVIDERS = ["MPESA", "ORANGE", "AIRTEL"] as const;

export function merchantMsisdn(provider: RailProvider): string {
  const bag = process.env as Record<string, string | undefined>;
  const key =
    provider === "MPESA"
      ? "SHIPSHOP_MSISDN_MPESA"
      : provider === "ORANGE"
        ? "SHIPSHOP_MSISDN_ORANGE"
        : "SHIPSHOP_MSISDN_AIRTEL";
  const configured = (bag[key] ?? "").trim();
  if (configured) return configured.replace(/\s/g, "");
  if (provider === "MPESA") return "+243810000100";
  if (provider === "ORANGE") return "+243890000100";
  return "+243990000100";
}

export function railLabel(provider: RailProvider) {
  if (provider === "MPESA") return "Vodacom M-Pesa";
  if (provider === "ORANGE") return "Orange Money";
  return "Airtel Money";
}

export function providerUssd(provider: RailProvider) {
  if (provider === "MPESA") return "150";
  if (provider === "ORANGE") return "144";
  return "500";
}

/** Collecte style Wave Checkout — V1 simulée vers caisse ShipShop. */
export type CollectionRequest = {
  amount: string;
  currency: string;
  mobile: string;
  client_reference: string;
  idempotency_key: string;
  success_url?: string;
  error_url?: string;
  provider: RailProvider;
};

export type CollectionSession = {
  id: string;
  status: "PENDING";
  merchantMsisdn: string;
  ussdHint: string;
  client_reference: string;
};

export function createCollectionSession(
  input: CollectionRequest,
): CollectionSession {
  const merchant = merchantMsisdn(input.provider);
  const code = providerUssd(input.provider);
  return {
    id: input.idempotency_key,
    status: "PENDING",
    merchantMsisdn: merchant,
    client_reference: input.client_reference,
    ussdHint: `*${code}# puis envoyez ${input.amount} ${input.currency} à ${merchant} (${railLabel(input.provider)})`,
  };
}
