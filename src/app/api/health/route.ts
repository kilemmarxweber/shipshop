import { connection, NextResponse } from "next/server";

/** Processus vivant. Aucune dépendance, aucune donnée. */
export async function GET() {
  await connection();
  return NextResponse.json({ ok: true });
}
