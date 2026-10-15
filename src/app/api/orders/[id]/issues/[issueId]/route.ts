import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const patchSchema = z.object({
  action: z.enum(["confirm_change", "reject", "resolve"]),
  note: z.string().max(500).optional(),
});

async function ackUrgentMessages(
  tx: Prisma.TransactionClient,
  issueId: string,
) {
  await tx.message.updateMany({
    where: {
      orderIssueId: issueId,
      isUrgent: true,
      requiresAck: true,
    },
    data: {
      requiresAck: false,
      readAt: new Date(),
    },
  });
}

/**
 * Vendeur confirme le changement / rejette / clôture le signalement.
 * → acquitte les messages urgents (plus « non lus »).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; issueId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id: orderId, issueId } = await params;
    const body = patchSchema.parse(await req.json());

    const issue = await withDbRetry(() =>
      prisma.orderIssue.findUnique({
        where: { id: issueId },
        include: {
          order: {
            include: { shop: { select: { organizationId: true } } },
          },
        },
      }),
    );

    if (!issue || issue.orderId !== orderId) {
      return NextResponse.json(
        { error: "Signalement introuvable" },
        { status: 404 },
      );
    }

    const member = await withDbRetry(() =>
      prisma.member.findFirst({
        where: {
          userId: session.user.id,
          organizationId: issue.order.shop.organizationId,
        },
      }),
    );
    if (!member) {
      return NextResponse.json({ error: "Réservé au vendeur" }, { status: 403 });
    }

    if (
      issue.status === "RESOLVED" ||
      issue.status === "REJECTED" ||
      issue.status === "CHANGE_CONFIRMED"
    ) {
      return NextResponse.json(
        { error: "Signalement déjà clôturé" },
        { status: 400 },
      );
    }

    const nextStatus =
      body.action === "confirm_change"
        ? "CHANGE_CONFIRMED"
        : body.action === "reject"
          ? "REJECTED"
          : "RESOLVED";

    const updated = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const next = await tx.orderIssue.update({
          where: { id: issueId },
          data: {
            status: nextStatus,
            resolvedAt: new Date(),
          },
        });

        await ackUrgentMessages(tx, issueId);

        if (issue.conversationId) {
          const reply =
            body.action === "confirm_change"
              ? `✅ Changement confirmé par le vendeur.${body.note ? `\n${body.note}` : ""}`
              : body.action === "reject"
                ? `❌ Signalement refusé.${body.note ? `\n${body.note}` : ""}`
                : `✔️ Signalement clôturé.${body.note ? `\n${body.note}` : ""}`;

          await tx.message.create({
            data: {
              conversationId: issue.conversationId,
              senderId: session.user.id,
              body: reply,
              kind: "ISSUE_RESOLUTION",
              orderIssueId: issueId,
            },
          });
          await tx.conversation.update({
            where: { id: issue.conversationId },
            data: { updatedAt: new Date() },
          });
        }

        await tx.deliveryEvent.create({
          data: {
            orderId,
            status: issue.order.status,
            note: `Signalement → ${nextStatus}`,
            actorUserId: session.user.id,
          },
        });

        return next;
      }),
    );

    return NextResponse.json({ issue: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Action impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
