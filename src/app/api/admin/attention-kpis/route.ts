import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { getSession } from "@/lib/session";
import { loadAttentionKpis } from "@/lib/growth/kpis";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") ?? "30");
  const kpis = await loadAttentionKpis(
    Number.isFinite(days) ? Math.min(90, Math.max(7, days)) : 30,
  );
  return NextResponse.json({ kpis });
}
