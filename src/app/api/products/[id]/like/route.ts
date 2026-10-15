import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { formatMoney } from "@/lib/utils";

const LIKE_MARKER = "❤️ Nouveau like Chip Shop";

function buildLikeMessage(input: {
  clientName: string;
  product: {
    id: string;
    title: string;
    priceCents: number;
    category: string;
    location: string | null;
    colors: string[];
    sizes: string[];
    images: string[];
  };
  appUrl: string;
}) {
  const { clientName, product, appUrl } = input;
  const link = `${appUrl}/product/${product.id}`;
  const lines = [
    LIKE_MARKER,
    "",
    `Client : ${clientName}`,
    `Produit : ${product.title}`,
    `Prix : ${formatMoney(product.priceCents)}`,
    `Catégorie : ${product.category}`,
    `Lieu : ${product.location ?? "—"}`,
    `Réf. produit : ${product.id}`,
  ];
  if (product.colors.length) {
    lines.push(`Couleurs : ${product.colors.join(", ")}`);
  }
  if (product.sizes.length) {
    lines.push(`Tailles : ${product.sizes.join(", ")}`);
  }
  if (product.images[0]) {
    lines.push(`Image : ${product.images[0]}`);
  }
  lines.push(`Lien : ${link}`);
  lines.push("");
  lines.push("Un client a aimé votre produit.");
  return lines.join("\n");
}

async function notifySellerOfLike(
  buyerId: string,
  buyerName: string,
  product: {
    id: string;
    shopId: string;
    title: string;
    priceCents: number;
    category: string;
    location: string | null;
    colors: string[];
    sizes: string[];
    images: string[];
  },
) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";

  let conversation = await withDbRetry(() =>
    prisma.conversation.findUnique({
      where: {
        buyerId_shopId: {
          buyerId,
          shopId: product.shopId,
        },
      },
    }),
  );

  if (!conversation) {
    conversation = await withDbRetry(() =>
      prisma.conversation.create({
        data: {
          buyerId,
          shopId: product.shopId,
          productId: product.id,
        },
      }),
    );
  } else if (!conversation.productId) {
    conversation = await withDbRetry(() =>
      prisma.conversation.update({
        where: { id: conversation!.id },
        data: { productId: product.id },
      }),
    );
  }

  const body = buildLikeMessage({
    clientName: buyerName,
    product,
    appUrl,
  });

  await withDbRetry(() =>
    prisma.message.create({
      data: {
        conversationId: conversation!.id,
        senderId: buyerId,
        body,
      },
    }),
  );
  await withDbRetry(() =>
    prisma.conversation.update({
      where: { id: conversation!.id },
      data: { updatedAt: new Date() },
    }),
  );

  return conversation.id;
}

async function removeLikeMessages(buyerId: string, productId: string) {
  const product = await withDbRetry(() =>
    prisma.product.findUnique({
      where: { id: productId },
      select: { shopId: true },
    }),
  );
  if (!product) return;

  const conversation = await withDbRetry(() =>
    prisma.conversation.findUnique({
      where: {
        buyerId_shopId: {
          buyerId,
          shopId: product.shopId,
        },
      },
      select: { id: true },
    }),
  );
  if (!conversation) return;

  await withDbRetry(() =>
    prisma.message.deleteMany({
      where: {
        conversationId: conversation.id,
        senderId: buyerId,
        body: {
          startsWith: LIKE_MARKER,
          contains: `Réf. produit : ${productId}`,
        },
      },
    }),
  );

  await withDbRetry(() =>
    prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    }),
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: productId } = await params;
  const product = await withDbRetry(() =>
    prisma.product.findUnique({ where: { id: productId } }),
  );
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const existing = await withDbRetry(() =>
    prisma.productLike.findUnique({
      where: {
        userId_productId: { userId: session.user.id, productId },
      },
    }),
  );

  let conversationId: string | undefined;
  if (!existing) {
    await withDbRetry(() =>
      prisma.productLike.create({
        data: { userId: session.user.id, productId },
      }),
    );
    try {
      conversationId = await notifySellerOfLike(
        session.user.id,
        session.user.name ?? "Client Chip Shop",
        product,
      );
    } catch (error) {
      console.error("[like notify]", error);
    }
  }

  const likesCount = await withDbRetry(() =>
    prisma.productLike.count({ where: { productId } }),
  );

  return NextResponse.json({
    liked: true,
    likesCount,
    conversationId,
    notified: Boolean(!existing && conversationId),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id: productId } = await params;

  await withDbRetry(() =>
    prisma.productLike.deleteMany({
      where: { userId: session.user.id, productId },
    }),
  );

  try {
    await removeLikeMessages(session.user.id, productId);
  } catch (error) {
    console.error("[like unnotify]", error);
  }

  const likesCount = await withDbRetry(() =>
    prisma.productLike.count({ where: { productId } }),
  );

  return NextResponse.json({ liked: false, likesCount, messageRemoved: true });
}
