import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMovementForUser } from "@/lib/payments/mobile-money";
import { expireStaleMovements, flushNotifyOutbox } from "@/lib/payments/ledger";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  await expireStaleMovements();
  void flushNotifyOutbox();

  const url = new URL(req.url);
  const movement = await getMovementForUser(session.user.id, {
    id: url.searchParams.get("id"),
    idempotencyKey: url.searchParams.get("idempotencyKey"),
  });
  if (!movement) {
    return NextResponse.json({ error: "Mouvement introuvable" }, { status: 404 });
  }
  return NextResponse.json({ movement });
}
