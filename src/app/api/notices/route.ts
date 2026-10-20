import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const notices = await withDbRetry(() =>
    prisma.appNotice.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  );
  const unread = notices.filter((n) => !n.readAt).length;
  return NextResponse.json({ notices, unread });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (ids.length) {
    await withDbRetry(() =>
      prisma.appNotice.updateMany({
        where: { userId: session.user.id, id: { in: ids } },
        data: { readAt: new Date() },
      }),
    );
  }
  return NextResponse.json({ ok: true });
}
