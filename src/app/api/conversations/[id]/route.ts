import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canAccessConversation,
  conversationAccessRole,
} from "@/lib/conversation-access";
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

  // Ouvrir un fil restaure la conversation masquée de son côté.
  const role = await conversationAccessRole(session.user.id, conversation);
  if (role === "buyer" && conversation.buyerDeletedAt) {
    await withDbRetry(() =>
      prisma.conversation.update({
        where: { id },
        data: { buyerDeletedAt: null },
      }),
    );
  } else if (role === "seller" && conversation.sellerDeletedAt) {
    await withDbRetry(() =>
      prisma.conversation.update({
        where: { id },
        data: { sellerDeletedAt: null },
      }),
    );
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
          data: {
            updatedAt: new Date(),
            // Un nouveau message rend la conversation visible des deux côtés.
            buyerDeletedAt: null,
            sellerDeletedAt: null,
          },
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

export async function DELETE(
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

  const role = await conversationAccessRole(session.user.id, conversation);
  if (!role) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Plateforme (owner/admin) : suppression réelle. Le participant masque
  // uniquement son inbox ; l'autre côté conserve son historique.
  if (role === "platform") {
    await withDbRetry(() =>
      prisma.conversation.delete({ where: { id } }),
    );
    return NextResponse.json({ deleted: true, mode: "hard" });
  }

  await withDbRetry(() =>
    prisma.conversation.update({
      where: { id },
      data:
        role === "buyer"
          ? { buyerDeletedAt: new Date() }
          : { sellerDeletedAt: new Date() },
    }),
  );

  return NextResponse.json({ deleted: true, mode: "hidden" });
}
