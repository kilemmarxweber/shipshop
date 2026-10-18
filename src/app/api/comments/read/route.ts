import { NextResponse } from "next/server";
import { z } from "zod";
import { shopIdsForSellerInbox } from "@/lib/conversation-access";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const schema = z.object({
  commentIds: z.array(z.string().min(1)).min(1).max(100),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const shopIds = await shopIdsForSellerInbox(session.user.id);
  if (shopIds.length === 0) {
    return NextResponse.json({ marked: 0 });
  }

  const comments = await withDbRetry(() =>
    prisma.productComment.findMany({
      where: {
        id: { in: body.commentIds },
        product: { shopId: { in: shopIds } },
      },
      select: { id: true },
    }),
  );

  let marked = 0;
  for (const comment of comments) {
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
    marked += 1;
  }

  return NextResponse.json({ marked });
}
