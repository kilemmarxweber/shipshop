import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, withDbRetry } from "@/lib/prisma";

const schema = z.object({
  kind: z.enum(["impression", "click", "conversion"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    const data =
      body.kind === "impression"
        ? { impressions: { increment: 1 } }
        : body.kind === "click"
          ? { clicks: { increment: 1 } }
          : { conversions: { increment: 1 } };
    await withDbRetry(() =>
      prisma.brandCampaign.update({
        where: { id },
        data,
      }),
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Événement refusé" }, { status: 400 });
  }
}
