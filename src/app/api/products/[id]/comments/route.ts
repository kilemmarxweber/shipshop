import { NextResponse } from "next/server";
import { z } from "zod";
import { shopIdsForSellerInbox } from "@/lib/conversation-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { takeRateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { recordUserActivity } from "@/lib/growth/activity";

const createSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

const COMMENT_SELECT = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, name: true, image: true } },
} as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: productId } = await params;

  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true },
    }),
  );
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const comments = await withDbRetry(() =>
    prisma.productComment.findMany({
      where: { productId },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: COMMENT_SELECT,
    }),
  );

  const commentsCount = await withDbRetry(() =>
    prisma.productComment.count({ where: { productId } }),
  );

  return NextResponse.json({ comments, commentsCount });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const user = await withDbRetry(() =>
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { disabledAt: true },
    }),
  );
  if (user?.disabledAt) {
    return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
  }

  if (!takeRateLimit(`comment:${session.user.id}`, 8, 60_000)) {
    return NextResponse.json(
      { error: "Trop de commentaires — réessayez dans une minute" },
      { status: 429 },
    );
  }

  const { id: productId } = await params;
  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(await _req.json());
  } catch {
    return NextResponse.json({ error: "Commentaire invalide" }, { status: 400 });
  }

  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, status: true, shopId: true },
    }),
  );
  if (!product || product.status !== "ACTIVE") {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const comment = await withDbRetry(() =>
    prisma.productComment.create({
      data: {
        productId,
        userId: session.user.id,
        body: body.body,
      },
      select: COMMENT_SELECT,
    }),
  );

  const sellerShopIds = await shopIdsForSellerInbox(session.user.id);
  if (sellerShopIds.includes(product.shopId)) {
    await withDbRetry(() =>
      prisma.productCommentRead.upsert({
        where: {
          userId_commentId: {
            userId: session.user.id,
            commentId: comment.id,
          },
        },
        create: { userId: session.user.id, commentId: comment.id },
        update: {},
      }),
    );
  }

  const commentsCount = await withDbRetry(() =>
    prisma.productComment.count({ where: { productId } }),
  );

  void recordUserActivity(session.user.id, "comment");
  return NextResponse.json({ comment, commentsCount }, { status: 201 });
}
