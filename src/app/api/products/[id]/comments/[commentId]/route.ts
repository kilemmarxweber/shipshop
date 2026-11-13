import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Retire un commentaire.
 * Autorisé : l'auteur ou la plateforme (owner/admin).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: productId, commentId } = await params;
  const comment = await withDbRetry(() =>
    prisma.productComment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        userId: true,
        productId: true,
        product: { select: { shopId: true } },
      },
    }),
  );
  if (!comment || comment.productId !== productId) {
    return NextResponse.json(
      { error: "Commentaire introuvable" },
      { status: 404 },
    );
  }

  const isAuthor = comment.userId === session.user.id;
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isAuthor && !isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await withDbRetry(() =>
    prisma.productComment.delete({ where: { id: commentId } }),
  );

  const commentsCount = await withDbRetry(() =>
    prisma.productComment.count({ where: { productId } }),
  );

  return NextResponse.json({ deleted: true, commentsCount });
}
