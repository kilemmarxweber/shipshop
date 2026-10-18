import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import {
  merchantMsisdn,
  railLabel,
  RAIL_PROVIDERS,
} from "@/lib/payments/provider";
import { getSession } from "@/lib/session";

/** Float / numéros caisse (owner) — pas le solde client. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé à la plateforme" }, { status: 403 });
  }

  return NextResponse.json({
    rails: RAIL_PROVIDERS.map((provider) => ({
      provider,
      label: railLabel(provider),
      merchantMsisdn: merchantMsisdn(provider),
      floatCents: null,
    })),
  });
}
