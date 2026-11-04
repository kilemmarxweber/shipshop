import { prisma } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";
import { NextResponse } from "next/server";

type Hit = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  kind: "ARTIST" | "ORGANIZATION";
  orgName?: string;
  shopName?: string;
};

export async function GET(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const kind =
    url.searchParams.get("kind") === "ORGANIZATION" ? "ORGANIZATION" : "ARTIST";
  if (q.length < 2) {
    return NextResponse.json({ users: [] as Hit[] });
  }

  if (kind === "ORGANIZATION") {
    const [shops, orgs] = await Promise.all([
      prisma.shop.findMany({
        where: {
          isActive: true,
          ownerUserId: { not: null },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { organization: { name: { contains: q, mode: "insensitive" } } },
          ],
        },
        select: {
          name: true,
          owner: {
            select: { id: true, name: true, email: true, phone: true },
          },
          organization: { select: { name: true } },
        },
        take: 12,
        orderBy: { name: "asc" },
      }),
      prisma.organization.findMany({
        where: { name: { contains: q, mode: "insensitive" } },
        select: {
          name: true,
          members: {
            where: { role: { in: ["owner", "admin"] } },
            take: 1,
            select: {
              user: {
                select: { id: true, name: true, email: true, phone: true },
              },
            },
          },
        },
        take: 12,
        orderBy: { name: "asc" },
      }),
    ]);

    const seen = new Set<string>();
    const users: Hit[] = [];
    for (const shop of shops) {
      const owner = shop.owner;
      if (!owner || seen.has(owner.id)) continue;
      seen.add(owner.id);
      users.push({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        kind: "ORGANIZATION",
        orgName: shop.organization.name,
        shopName: shop.name,
      });
    }
    for (const org of orgs) {
      const owner = org.members[0]?.user;
      if (!owner || seen.has(owner.id)) continue;
      seen.add(owner.id);
      users.push({
        id: owner.id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        kind: "ORGANIZATION",
        orgName: org.name,
      });
      if (users.length >= 12) break;
    }
    return NextResponse.json({ users: users.slice(0, 12) });
  }

  const users = await prisma.user.findMany({
    where: {
      disabledAt: null,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    take: 12,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    users: users.map((user) => ({ ...user, kind: "ARTIST" as const })),
  });
}
