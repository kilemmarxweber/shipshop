import { NextResponse } from "next/server";
import { refundUndeliveredOrder } from "@/lib/checkout";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await withDbRetry(() =>
      prisma.$transaction((tx) =>
        refundUndeliveredOrder(tx, session.user.id, id),
      ),
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Remboursement impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
