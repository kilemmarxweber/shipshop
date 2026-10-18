import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "****";
  return `${phone.slice(0, 4)}****${digits.slice(-2)}`;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ recipients: [] });
  }

  const phoneQ = q.replace(/[\s-]/g, "");
  const phoneDigits = q.replace(/\D/g, "");
  const rows = await withDbRetry(() =>
    prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        disabledAt: null,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { ownedShops: { some: { name: { contains: q, mode: "insensitive" } } } },
          ...(phoneQ.length >= 4
            ? [
                { moneyContacts: { some: { phone: { contains: phoneQ } } } },
                { phone: { contains: phoneQ } },
              ]
            : []),
          ...(phoneDigits.length >= 4 && phoneDigits !== phoneQ
            ? [
                { moneyContacts: { some: { phone: { contains: phoneDigits } } } },
                { phone: { contains: phoneDigits } },
              ]
            : []),
        ],
      },
      take: 8,
      select: {
        id: true,
        name: true,
        phone: true,
        ownedShops: {
          where: { isActive: true },
          select: { name: true },
          take: 1,
        },
        moneyContacts: {
          select: { phone: true, provider: true },
          take: 3,
        },
      },
    }),
  );

  return NextResponse.json({
    recipients: rows.map((u) => ({
      id: u.id,
      name: u.name,
      shopName: u.ownedShops[0]?.name ?? null,
      phoneMasked: maskPhone(
        u.moneyContacts[0]?.phone ?? u.phone ?? "",
      ),
    })),
  });
}
