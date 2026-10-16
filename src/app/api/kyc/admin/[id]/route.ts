import { NextResponse } from "next/server";
import { z } from "zod";
import { KycStatus } from "@/generated/prisma/client";
import { assertChipShopOwner, kycPublic } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REVOKE"]),
  rejectReason: z.string().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json(
      { error: "Réservé à l'owner ou à un admin Chip Shop" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  try {
    const body = schema.parse(await req.json());
    const existing = await withDbRetry(() =>
      prisma.sellerKyc.findUnique({ where: { id } }),
    );
    if (!existing) {
      return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
    }
    if (body.action === "REVOKE") {
      if (existing.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Seul un dossier approuvé peut être révoqué" },
          { status: 409 },
        );
      }
      const reason = body.rejectReason?.trim() || "Révoqué par l'admin plateforme";
      const kyc = await withDbRetry(() =>
        prisma.sellerKyc.update({
          where: { id },
          data: {
            status: KycStatus.REJECTED,
            rejectReason: reason,
            reviewedAt: new Date(),
            reviewedById: session.user.id,
          },
        }),
      );
      return NextResponse.json({ kyc: kycPublic(kyc) });
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: "Ce dossier n’est pas en revue" },
        { status: 409 },
      );
    }

    if (body.action === "REJECT") {
      const reason = body.rejectReason?.trim();
      if (!reason) {
        return NextResponse.json(
          { error: "Indiquez un motif de refus" },
          { status: 400 },
        );
      }
      const kyc = await withDbRetry(() =>
        prisma.sellerKyc.update({
          where: { id },
          data: {
            status: KycStatus.REJECTED,
            rejectReason: reason,
            reviewedAt: new Date(),
            reviewedById: session.user.id,
          },
        }),
      );
      return NextResponse.json({ kyc: kycPublic(kyc) });
    }

    const kyc = await withDbRetry(() =>
      prisma.sellerKyc.update({
        where: { id },
        data: {
          status: KycStatus.APPROVED,
          rejectReason: null,
          reviewedAt: new Date(),
          reviewedById: session.user.id,
        },
      }),
    );
    return NextResponse.json({ kyc: kycPublic(kyc) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Revue impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
