import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessConversation } from "@/lib/conversation-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await canAccessConversation(session.user.id, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  await withDbRetry(() =>
    prisma.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: session.user.id },
        readAt: null,
        NOT: { isUrgent: true, requiresAck: true },
      },
      data: { readAt: new Date() },
    }),
  );

  const [messages, openIssues] = await Promise.all([
    withDbRetry(() =>
      prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { id: true, name: true, image: true } },
        },
      }),
    ),
    withDbRetry(() =>
      prisma.orderIssue.findMany({
        where: {
          conversationId: id,
          status: { in: ["OPEN", "SELLER_REPLIED"] },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderId: true,
          type: true,
          description: true,
          status: true,
          createdAt: true,
        },
      }),
    ),
  ]);

  return NextResponse.json({ conversation, messages, openIssues });
}

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const conversation = await canAccessConversation(session.user.id, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  try {
    const { body } = messageSchema.parse(await req.json());
    const isBuyer = conversation.buyerId === session.user.id;

    const message = await withDbRetry(() =>
      prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            conversationId: id,
            senderId: session.user.id,
            body: body.trim(),
          },
          include: {
            sender: { select: { id: true, name: true, image: true } },
          },
        });

        // Réponse vendeur → acquitte les urgences en attente
        if (!isBuyer) {
          await tx.message.updateMany({
            where: {
              conversationId: id,
              isUrgent: true,
              requiresAck: true,
            },
            data: {
              requiresAck: false,
              readAt: new Date(),
            },
          });
          await tx.orderIssue.updateMany({
            where: {
              conversationId: id,
              status: "OPEN",
            },
            data: { status: "SELLER_REPLIED" },
          });
        }

        await tx.conversation.update({
          where: { id },
          data: { updatedAt: new Date() },
        });

        return created;
      }),
    );

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erreur message";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
