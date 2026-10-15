import { NextResponse } from "next/server";
import { z } from "zod";
import { ISSUE_TYPE_LABELS, ISSUE_WINDOW_MS } from "@/lib/handover";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const createSchema = z.object({
  type: z.enum([
    "WRONG_SIZE",
    "WRONG_COLOR",
    "DEFECT",
    "WRONG_PRODUCT",
    "OTHER",
  ]),
  description: z.string().min(10).max(1000),
});

/**
 * Client signale un souci (taille / erreur) après remise.
 * → message urgent au vendeur, reste non lu jusqu'à réponse / confirmation.
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
    const { id: orderId } = await params;
    const body = createSchema.parse(await req.json());

    const order = await withDbRetry(() =>
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          pickupReceipt: true,
          product: { select: { id: true, title: true } },
          shop: { select: { id: true, name: true } },
          issues: { where: { status: { in: ["OPEN", "SELLER_REPLIED"] } } },
        },
      }),
    );

    if (!order || order.buyerId !== session.user.id) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    if (order.status !== "DELIVERED" && order.status !== "PICKED_UP") {
      return NextResponse.json(
        {
          error:
            "Vous ne pouvez signaler un souci qu'après remise confirmée (scan QR / code)",
        },
        { status: 400 },
      );
    }

    if (!order.pickupReceipt?.redeemedAt) {
      return NextResponse.json(
        { error: "Remise non confirmée — impossible de signaler" },
        { status: 400 },
      );
    }

    const elapsed =
      Date.now() - new Date(order.pickupReceipt.redeemedAt).getTime();
    if (elapsed > ISSUE_WINDOW_MS) {
      return NextResponse.json(
        {
          error:
            "Délai dépassé (48 h après remise) pour signaler un changement / souci",
        },
        { status: 400 },
      );
    }

    if (order.issues.length > 0) {
      return NextResponse.json(
        {
          error: "Un signalement est déjà ouvert sur cette commande",
          issueId: order.issues[0].id,
        },
        { status: 409 },
      );
    }

    const typeLabel = ISSUE_TYPE_LABELS[body.type] ?? body.type;
    const urgentBody = [
      "🚨 SIGNALEMENT URGENT — Chip Shop",
      "",
      `Type : ${typeLabel}`,
      `Commande : ${order.id}`,
      `Produit : ${order.product.title}`,
      `Boutique : ${order.shop.name}`,
      `Client : ${session.user.name ?? "Client"}`,
      "",
      "Description :",
      body.description.trim(),
      "",
      "⚠️ Ce message reste non lu jusqu'à votre réponse ou la confirmation du changement.",
    ].join("\n");

    const result = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        let conversation = await tx.conversation.findUnique({
          where: {
            buyerId_shopId: {
              buyerId: session.user.id,
              shopId: order.shopId,
            },
          },
        });

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: {
              buyerId: session.user.id,
              shopId: order.shopId,
              productId: order.productId,
            },
          });
        } else if (!conversation.productId) {
          conversation = await tx.conversation.update({
            where: { id: conversation.id },
            data: { productId: order.productId },
          });
        }

        const issue = await tx.orderIssue.create({
          data: {
            orderId: order.id,
            buyerId: session.user.id,
            shopId: order.shopId,
            type: body.type,
            description: body.description.trim(),
            status: "OPEN",
            conversationId: conversation.id,
          },
        });

        const message = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderId: session.user.id,
            body: urgentBody,
            isUrgent: true,
            requiresAck: true,
            orderIssueId: issue.id,
            kind: "URGENT_ISSUE",
          },
        });

        await tx.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: order.status,
            note: `Signalement client: ${typeLabel}`,
            actorUserId: session.user.id,
          },
        });

        return { issue, message, conversationId: conversation.id };
      }),
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signalement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const order = await withDbRetry(() =>
    prisma.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true, shopId: true, shop: { select: { organizationId: true } } },
    }),
  );
  if (!order) {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  const isBuyer = order.buyerId === session.user.id;
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: {
        userId: session.user.id,
        organizationId: order.shop.organizationId,
      },
    }),
  );
  if (!isBuyer && !member) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const issues = await withDbRetry(() =>
    prisma.orderIssue.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    }),
  );

  return NextResponse.json({ issues });
}
