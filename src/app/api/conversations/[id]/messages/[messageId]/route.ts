import { NextResponse } from "next/server";
import { canAccessConversation } from "@/lib/conversation-access";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Supprime un message.
 * Autorisé : l'expéditeur ou la plateforme (owner/admin).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id, messageId } = await params;
  const conversation = await canAccessConversation(session.user.id, id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
  }

  const message = await withDbRetry(() =>
    prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true },
    }),
  );
  if (!message || message.conversationId !== id) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
  }

  const isSender = message.senderId === session.user.id;
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isSender && !isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await withDbRetry(() => prisma.message.delete({ where: { id: messageId } }));

  return NextResponse.json({ deleted: true });
}
