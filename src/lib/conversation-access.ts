import { prisma, withDbRetry } from "@/lib/prisma";

/** Inbox : acheteur de la conv, ou propriétaire de la boutique. */
export function conversationInboxWhere(userId: string) {
  return {
    OR: [{ buyerId: userId }, { shop: { ownerUserId: userId } }],
  };
}

export async function canAccessConversation(
  userId: string,
  conversationId: string,
) {
  const conversation = await withDbRetry(() =>
    prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            organizationId: true,
            ownerUserId: true,
          },
        },
        product: {
          select: { id: true, title: true, images: true, priceCents: true },
        },
        buyer: { select: { id: true, name: true, image: true } },
      },
    }),
  );
  if (!conversation) return null;
  if (conversation.buyerId === userId) return conversation;
  if (conversation.shop.ownerUserId === userId) return conversation;
  return null;
}
