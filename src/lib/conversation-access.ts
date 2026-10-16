import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";

/**
 * Inbox vendeur : propriétaire de la boutique, ou collègue invité par ce
 * propriétaire. Pas l'org Chip Shop entière (tous les comptes y sont membres).
 */
async function shopOwnerIdsForStaff(userId: string): Promise<string[]> {
  const ids = new Set<string>([userId]);
  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    }),
  );
  if (!user?.email) return [...ids];

  const invites = await withDbRetry(() =>
    prisma.invitation.findMany({
      where: {
        email: user.email,
        status: "accepted",
      },
      select: { inviterId: true },
    }),
  );
  for (const row of invites) ids.add(row.inviterId);
  return [...ids];
}

export async function conversationInboxWhere(userId: string) {
  const { isOwner } = await assertChipShopOwner(userId);
  if (isOwner) return {};

  const ownerIds = await shopOwnerIdsForStaff(userId);
  return {
    OR: [{ buyerId: userId }, { shop: { ownerUserId: { in: ownerIds } } }],
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

  const { isOwner } = await assertChipShopOwner(userId);
  if (isOwner) return conversation;

  const ownerIds = await shopOwnerIdsForStaff(userId);
  if (
    conversation.shop.ownerUserId &&
    ownerIds.includes(conversation.shop.ownerUserId)
  ) {
    return conversation;
  }
  return null;
}
