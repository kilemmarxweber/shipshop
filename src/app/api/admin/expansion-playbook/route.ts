import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { getSession } from "@/lib/session";
import { expansionSummary } from "@/lib/growth/expansion-playbook";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return NextResponse.json(expansionSummary());
}
