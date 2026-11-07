import { DEFAULT_FX, parseCurrency, parseFxRate } from "@/lib/money";
import { prisma, withDbRetry } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";
import { adminEvent } from "@/lib/tickets/serialize";
import { NextResponse } from "next/server";
import { z } from "zod";

const typeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(400).optional().default(""),
  priceCents: z.number().int().min(1).max(100_000_000),
  quota: z.number().int().min(1).max(1_000_000),
});

const createSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000).optional().default(""),
    imageUrl: z.string().trim().max(500).optional().nullable(),
    venue: z.string().trim().min(2).max(160),
    city: z.string().trim().min(2).max(80),
    currency: z.enum(["USD", "CDF", "KW"]).optional(),
    fxCdfPerUsd: z.number().int().min(1).max(100_000).optional(),
    fxKwPerUsd: z.number().int().min(1).max(100_000).optional(),
    capacity: z.number().int().min(1).max(1_000_000).optional().nullable(),
    accessNote: z.string().trim().max(500).optional().nullable(),
    organizerKind: z.enum(["ARTIST", "ORGANIZATION"]),
    organizerName: z.string().trim().min(2).max(120),
    organizerUserId: z.string().min(1).optional(),
    platformFeeMode: z.enum(["PERCENT", "FLAT"]),
    platformFeeBps: z.number().int().min(0).max(10_000).optional(),
    platformFeeCents: z.number().int().min(0).max(100_000_000).optional(),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    salesStartsAt: z.string().optional().nullable(),
    salesEndsAt: z.string().optional().nullable(),
    accessStartsAt: z.string().optional().nullable(),
    accessEndsAt: z.string().optional().nullable(),
    ticketTypes: z.array(typeSchema).min(1).max(8),
  })
  .superRefine((value, ctx) => {
    if (
      value.platformFeeMode === "PERCENT" &&
      (value.platformFeeBps ?? 0) <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Indique un pourcentage de commission",
        path: ["platformFeeBps"],
      });
    }
    if (
      value.platformFeeMode === "FLAT" &&
      (value.platformFeeCents ?? 0) <= 0
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Indique un montant de commission",
        path: ["platformFeeCents"],
      });
    }
  });

function asDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
}

const eventInclude = {
  ticketTypes: { orderBy: { sortOrder: "asc" as const } },
  organizer: { select: { id: true, name: true, email: true } },
} as const;

export async function GET() {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  try {
    const events = await withDbRetry(() =>
      prisma.event.findMany({
        orderBy: { createdAt: "desc" },
        take: 80,
        include: eventInclude,
      }),
    );
    return NextResponse.json({ events: events.map(adminEvent) });
  } catch (cause) {
    console.error("[admin/events] GET failed", cause);
    // Fallback léger pour les pickers (challenges / billets) si include organizer plante
    try {
      const events = await withDbRetry(() =>
        prisma.event.findMany({
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            ticketTypes: { orderBy: { sortOrder: "asc" as const } },
          },
        }),
      );
      return NextResponse.json({
        events: events.map((event) =>
          adminEvent({
            ...event,
            organizerUserId: event.organizerUserId,
            createdByUserId: event.createdByUserId,
            platformFeeMode: event.platformFeeMode,
            platformFeeBps: event.platformFeeBps,
            platformFeeCents: event.platformFeeCents,
            settledAt: event.settledAt,
            organizer: undefined,
          }),
        ),
      });
    } catch (fallbackError) {
      console.error("[admin/events] fallback failed", fallbackError);
      return NextResponse.json(
        { error: "Impossible de charger les events", events: [] },
        { status: 500 },
      );
    }
  }
}

export async function POST(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const startsAt = asDate(body.startsAt);
  const endsAt = asDate(body.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) {
    return NextResponse.json(
      { error: "Dates de l’événement invalides" },
      { status: 400 },
    );
  }
  let organizerId = auth.session.user.id;
  if (body.organizerUserId) {
    const organizer = await prisma.user.findUnique({
      where: { id: body.organizerUserId },
      select: { id: true },
    });
    if (organizer) organizerId = organizer.id;
  }

  const fxCdfPerUsd = parseFxRate(body.fxCdfPerUsd, DEFAULT_FX.cdfPerUsd);
  const fxKwPerUsd = parseFxRate(body.fxKwPerUsd, DEFAULT_FX.kwPerUsd);
  const event = await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      imageUrl: body.imageUrl?.trim() || null,
      venue: body.venue,
      city: body.city,
      currency: parseCurrency(body.currency),
      fxCdfPerUsd,
      fxKwPerUsd,
      fxRateUpdatedAt: new Date(),
      capacity: body.capacity ?? null,
      accessNote: body.accessNote?.trim() || null,
      organizerKind: body.organizerKind,
      organizerName: body.organizerName,
      organizerUserId: organizerId,
      createdByUserId: auth.session.user.id,
      platformFeeMode: body.platformFeeMode,
      platformFeeBps:
        body.platformFeeMode === "PERCENT" ? (body.platformFeeBps ?? 1000) : 0,
      platformFeeCents:
        body.platformFeeMode === "FLAT" ? (body.platformFeeCents ?? 0) : 0,
      startsAt,
      endsAt,
      salesStartsAt: asDate(body.salesStartsAt),
      salesEndsAt: asDate(body.salesEndsAt),
      accessStartsAt: asDate(body.accessStartsAt),
      accessEndsAt: asDate(body.accessEndsAt),
      ticketTypes: {
        create: body.ticketTypes.map((type, index) => ({
          name: type.name,
          description: type.description,
          priceCents: type.priceCents,
          quota: type.quota,
          sortOrder: index,
        })),
      },
    },
    include: eventInclude,
  });
  return NextResponse.json({ event: adminEvent(event) }, { status: 201 });
}
