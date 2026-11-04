import { assertChipShopOwner } from "@/lib/kyc";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

export async function requirePlatformSession() {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return {
      error: NextResponse.json(
        { error: "Réservé à l'owner ou l'admin ShipShop" },
        { status: 403 },
      ),
    };
  }
  return { session };
}

export async function requireBuyerSession() {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }),
    };
  }
  return { session };
}

export function ticketHttp(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number((error as { status: number }).status)
      : 400;
  const message = error instanceof Error ? error.message : "Erreur billets";
  return NextResponse.json(
    { error: message },
    { status: Number.isFinite(status) && status >= 400 ? status : 400 },
  );
}
