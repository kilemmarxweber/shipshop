import { NextResponse } from "next/server";
import { z } from "zod";
import { conversationInboxWhere } from "@/lib/conversation-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const startSchema = z.object({
  shopId: z.string().min(1),
  productId: z.string().optional(),
  message: z.string().max(1000).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const inboxWhere = await conversationInboxWhere(session.user.id);
    const conversations = await withDbRetry(() =>
      prisma.conversation.findMany({
        where: inboxWhere,
        include: {
          shop: { select: { id: true, name: true, slug: true, logoUrl: true } },
          product: { select: { id: true, title: true, images: true } },
          buyer: { select: { id: true, name: true, image: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              body: true,
              createdAt: true,
              senderId: true,
              isUrgent: true,
              requiresAck: true,
              readAt: true,
            },
          },
          _count: {
            select: {
              messages: {
                where: {
                  senderId: { not: session.user.id },
                  readAt: null,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    );

    const enriched = conversations.map((c) => {
      const unreadCount = c._count.messages;
      return {
        ...c,
        unreadCount,
        urgentPending: Boolean(
          c.messages[0]?.isUrgent && c.messages[0]?.requiresAck,
        ),
      };
    });

    return NextResponse.json({ conversations: enriched });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur conversations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const body = startSchema.parse(await req.json());
    const shop = await withDbRetry(() =>
      prisma.shop.findUnique({ where: { id: body.shopId } }),
    );
    if (!shop) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    let conversation = await withDbRetry(() =>
      prisma.conversation.findUnique({
        where: {
          buyerId_shopId: {
            buyerId: session.user.id,
            shopId: body.shopId,
          },
        },
      }),
    );

    if (!conversation) {
      conversation = await withDbRetry(() =>
        prisma.conversation.create({
          data: {
            buyerId: session.user.id,
            shopId: body.shopId,
            productId: body.productId,
          },
        }),
      );
    } else if (body.productId && !conversation.productId) {
      conversation = await withDbRetry(() =>
        prisma.conversation.update({
          where: { id: conversation!.id },
          data: { productId: body.productId },
        }),
      );
    }

    const opener = body.message?.trim();
    if (opener) {
      await withDbRetry(() =>
        prisma.message.create({
          data: {
            conversationId: conversation!.id,
            senderId: session.user.id,
            body: opener,
          },
        }),
      );
      await withDbRetry(() =>
        prisma.conversation.update({
          where: { id: conversation!.id },
          data: { updatedAt: new Date() },
        }),
      );
    }

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur conversation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
