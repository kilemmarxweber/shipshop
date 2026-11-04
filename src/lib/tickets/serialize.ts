export function publicEvent(event: {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  venue: string;
  city: string;
  currency: string;
  capacity: number | null;
  accessNote: string | null;
  status: string;
  organizerKind: string;
  organizerName: string;
  startsAt: Date;
  endsAt: Date;
  salesStartsAt: Date | null;
  salesEndsAt: Date | null;
  accessStartsAt: Date | null;
  accessEndsAt: Date | null;
  ticketTypes?: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    quota: number;
    soldCount: number;
    sortOrder: number;
  }[];
}) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl,
    venue: event.venue,
    city: event.city,
    currency: event.currency,
    capacity: event.capacity,
    accessNote: event.accessNote,
    status: event.status,
    organizerKind: event.organizerKind,
    organizerName: event.organizerName,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    salesStartsAt: event.salesStartsAt?.toISOString() ?? null,
    salesEndsAt: event.salesEndsAt?.toISOString() ?? null,
    accessStartsAt: event.accessStartsAt?.toISOString() ?? null,
    accessEndsAt: event.accessEndsAt?.toISOString() ?? null,
    ticketTypes: (event.ticketTypes ?? []).map((type) => ({
      id: type.id,
      name: type.name,
      description: type.description,
      priceCents: type.priceCents,
      quota: type.quota,
      remaining: Math.max(0, type.quota - type.soldCount),
      soldCount: type.soldCount,
      sortOrder: type.sortOrder,
    })),
  };
}

export function adminEvent(
  event: Parameters<typeof publicEvent>[0] & {
    organizerUserId: string;
    createdByUserId: string;
    platformFeeMode: string;
    platformFeeBps: number;
    platformFeeCents: number;
    settledAt: Date | null;
    organizer?: { id: string; name: string; email: string };
  },
) {
  return {
    ...publicEvent(event),
    organizerUserId: event.organizerUserId,
    createdByUserId: event.createdByUserId,
    platformFeeMode: event.platformFeeMode,
    platformFeeBps: event.platformFeeBps,
    platformFeeCents: event.platformFeeCents,
    settledAt: event.settledAt?.toISOString() ?? null,
    organizer: event.organizer
      ? {
          id: event.organizer.id,
          name: event.organizer.name,
          email: event.organizer.email,
        }
      : null,
  };
}

export function publicTicket(ticket: {
  id: string;
  status: string;
  currency: string;
  purchaseCents: number;
  code: string;
  qrPayload: string;
  checkedInAt: Date | null;
  createdAt: Date;
  event: {
    id: string;
    title: string;
    venue: string;
    city: string;
    startsAt: Date;
    endsAt: Date;
    organizerName: string;
    imageUrl: string | null;
    accessNote: string | null;
  };
  type: { id: string; name: string };
  refundRequests?: { id: string; status: string; reason: string }[];
}) {
  return {
    id: ticket.id,
    status: ticket.status,
    currency: ticket.currency,
    purchaseCents: ticket.purchaseCents,
    code: ticket.code,
    qrPayload: ticket.qrPayload,
    checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    event: {
      id: ticket.event.id,
      title: ticket.event.title,
      venue: ticket.event.venue,
      city: ticket.event.city,
      startsAt: ticket.event.startsAt.toISOString(),
      endsAt: ticket.event.endsAt.toISOString(),
      organizerName: ticket.event.organizerName,
      imageUrl: ticket.event.imageUrl,
      accessNote: ticket.event.accessNote,
    },
    type: ticket.type,
    refundRequest: ticket.refundRequests?.[0]
      ? {
          id: ticket.refundRequests[0].id,
          status: ticket.refundRequests[0].status,
          reason: ticket.refundRequests[0].reason,
        }
      : null,
  };
}
