import { NextResponse } from "next/server";
import { assertChipShopOwner } from "@/lib/kyc";
import { getSession } from "@/lib/session";
import {
  buildChallengeReport,
  challengeReportToCsv,
} from "@/lib/growth/challenge-report";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { isOwner } = await assertChipShopOwner(session.user.id);
  if (!isOwner) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const report = await buildChallengeReport(id);
  if (!report) {
    return NextResponse.json({ error: "Challenge introuvable" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("format") === "csv") {
    const csv = challengeReportToCsv(report);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="challenge-${id}-rapport.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(
    { report },
    { headers: { "Cache-Control": "no-store" } },
  );
}
