import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { assertCanManageShop } from "@/lib/shop-access";
import { utcMonthKey } from "@/lib/shiprewards/tiers";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const shopId = new URL(req.url).searchParams.get("shopId");
  if (!shopId) {
    return NextResponse.json({ error: "shopId requis" }, { status: 400 });
  }
  const access = await assertCanManageShop(session.user.id, shopId);
  if (!access.ok) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const monthKey = utcMonthKey();
  const state = await withDbRetry(() =>
    prisma.shopRewardState.findUnique({ where: { shopId } }),
  );
  return NextResponse.json({
    pointsBalance: state?.pointsBalance ?? 0,
    sellerTier: state?.sellerTier ?? "BRONZE",
    commissionGrantRemaining: state?.commissionGrantRemaining ?? 0,
    commissionBpsOff: state?.commissionBpsOff ?? 0,
    shipCashMonthCents:
      state?.shipCashMonthKey === monthKey ? state.shipCashMonthCents : 0,
  });
}
