import { NextResponse } from "next/server";
import type { PlatformFeeKind, Prisma } from "@/generated/prisma/client";
import { assertChipShopOwner } from "@/lib/kyc";
import { parsePeriod, periodStart } from "@/lib/reports";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Réservé au owner" }, { status: 403 });
  }

  const url = new URL(req.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const from = periodStart(period);
  const kind = url.searchParams.get("kind");
  const csv = url.searchParams.get("csv") === "1";

  const feeKind =
    kind === "SALE" || kind === "SHIPPING" || kind === "WITHDRAWAL"
      ? (kind as PlatformFeeKind)
      : undefined;
  const where: Prisma.PlatformFeeWhereInput = {
    reversedAt: null,
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(feeKind ? { kind: feeKind } : {}),
  };

  const fees = await withDbRetry(() =>
    prisma.platformFee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        order: {
          select: {
            id: true,
            shop: { select: { name: true } },
            courier: { select: { name: true } },
          },
        },
      },
    }),
  );

  const saleUsd = fees
    .filter((f) => f.kind === "SALE")
    .reduce((a, f) => a + f.amountUsdCents, 0);
  const shipUsd = fees
    .filter((f) => f.kind === "SHIPPING")
    .reduce((a, f) => a + f.amountUsdCents, 0);
  const wdUsd = fees
    .filter((f) => f.kind === "WITHDRAWAL")
    .reduce((a, f) => a + f.amountUsdCents, 0);

  if (csv) {
    const header = "date,kind,amountCents,currency,amountUsdCents,orderId,shop,courier\n";
    const rows = fees
      .map((f) =>
        [
          f.createdAt.toISOString(),
          f.kind,
          f.amountCents,
          f.currency,
          f.amountUsdCents,
          f.orderId ?? "",
          f.order?.shop.name ?? "",
          f.order?.courier?.name ?? "",
        ].join(","),
      )
      .join("\n");
    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=platform-fees.csv",
      },
    });
  }

  return NextResponse.json({
    summary: {
      saleUsdCents: saleUsd,
      shippingUsdCents: shipUsd,
      withdrawalUsdCents: wdUsd,
      totalUsdCents: saleUsd + shipUsd + wdUsd,
      saleCount: fees.filter((f) => f.kind === "SALE").length,
      shippingCount: fees.filter((f) => f.kind === "SHIPPING").length,
    },
    fees: fees.map((f) => ({
      id: f.id,
      kind: f.kind,
      amountCents: f.amountCents,
      currency: f.currency,
      amountUsdCents: f.amountUsdCents,
      createdAt: f.createdAt,
      orderId: f.orderId,
      shopName: f.order?.shop.name ?? null,
      courierName: f.order?.courier?.name ?? null,
    })),
  });
}
