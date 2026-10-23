import { prisma, withDbRetry } from "@/lib/prisma";

export async function createAppNotice(input: {
  userId: string;
  title: string;
  body: string;
  href?: string | null;
}) {
  if (typeof prisma.appNotice?.create !== "function") return null;
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

/** Fan-out cloche (lives, campagnes…) — ignore silencieusement si table absente. */
export async function createAppNoticesMany(
  userIds: string[],
  notice: { title: string; body: string; href?: string | null },
) {
  if (typeof prisma.appNotice?.createMany !== "function") return 0;
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return 0;
  const title = notice.title.slice(0, 160);
  const body = notice.body.slice(0, 2000);
  const href = notice.href ?? null;
  const chunk = 400;
  let created = 0;
  for (let i = 0; i < unique.length; i += chunk) {
    const slice = unique.slice(i, i + chunk);
    const result = await withDbRetry(() =>
      prisma.appNotice.createMany({
        data: slice.map((userId) => ({ userId, title, body, href })),
      }),
    );
    created += result.count;
  }
  return created;
}
