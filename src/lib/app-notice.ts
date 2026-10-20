import { prisma, withDbRetry } from "@/lib/prisma";

export async function createAppNotice(input: {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  return withDbRetry(() =>
    prisma.appNotice.create({
      data: {
        userId: input.userId,
        title: input.title.slice(0, 160),
        body: input.body.slice(0, 2000),
        href: input.href ?? null,
      },
    }),
  );
}
