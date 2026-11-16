import { connection, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";

/** Postgres joignable. Le détail d'erreur SQL n'est pas renvoyé. */
export async function GET() {
  await connection();
  try {
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
