import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrderByVendor } from "@/lib/checkout";
import type { CancelReasonCode } from "@/lib/order-cancel";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  reason: z.enum([
    "OUT_OF_STOCK",
    "DEFECTIVE",
    "DAMAGED",
    "UNAVAILABLE",
    "LOGISTICS",
    "OTHER",
  ]),
  note: z.string().max(500).optional(),
});

/**
 * Annulation vendeur : rembourse le client + message d'excuse avec motif.
 * Interdit si déjà livré / remis (QR).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = schema.parse(await req.json());

    const result = await withDbRetry(() =>
      prisma.$transaction((tx) =>
        cancelOrderByVendor(
          tx,
          session.user.id,
          id,
          body.reason as CancelReasonCode,
          body.note,
        ),
      ),
    );

    return NextResponse.json({
      order: result.order,
      balanceCents: result.balanceCents,
      conversationId: result.conversationId,
      reason: result.reason,
      reasonLabel: result.reasonLabel,
      message: "Commande annulée — client remboursé et notifié",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Annulation impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
