import type { Prisma } from "@/generated/prisma/client";
import {
    creditWalletLocked,
    debitWalletLocked,
    writeAudit,
    type AuditCtx,
} from "@/lib/payments/ledger";
import { debitWalletWithFx } from "@/lib/payments/fx-wallet";
import { PURCHASE_PROVIDER } from "@/lib/payments/rails";
import {
    creditTreasury,
    debitTreasury,
    ensureTreasury,
    reverseTicketFee,
} from "@/lib/platform-ledger";
import { prisma } from "@/lib/prisma";
import {
    eventCurrency,
    isAccessWindowOpen,
    isSalesWindowOpen,
    platformTicketCut,
} from "@/lib/tickets/fee";
import {
    buildTicketQrPayload,
    mintTicketCode,
    signTicketHmac,
} from "@/lib/tickets/qr";
import { publicTicket } from "@/lib/tickets/serialize";

type Tx = Prisma.TransactionClient;

const ticketInclude = {
  event: {
    select: {
      id: true,
      title: true,
      venue: true,
      city: true,
      startsAt: true,
      endsAt: true,
      organizerName: true,
      imageUrl: true,
      accessNote: true,
    },
  },
  type: { select: { id: true, name: true } },
  refundRequests: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, status: true, reason: true },
  },
} as const;

export class TicketError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function lockTicketType(tx: Tx, typeId: string) {
  await tx.ticketType.update({
    where: { id: typeId },
    data: { updatedAt: new Date() },
    select: { id: true },
  });
}

export async function purchaseTickets(input: {
  buyerUserId: string;
  eventId: string;
  ticketTypeId: string;
  qty: number;
  acceptedNonRefundable: boolean;
  audit: AuditCtx;
}) {
  if (!input.acceptedNonRefundable) {
    throw new TicketError(
      400,
      "Accepte la politique non remboursable pour acheter",
    );
  }
  const qty = Math.floor(input.qty);
  if (qty < 1 || qty > 10) {
    throw new TicketError(400, "Quantité invalide (1 à 10)");
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({
      where: { id: input.eventId },
      include: { ticketTypes: true },
    });
    if (!event) throw new TicketError(404, "Événement introuvable");
    if (!isSalesWindowOpen(event)) {
      throw new TicketError(409, "La vente n’est pas ouverte");
    }
    const type = event.ticketTypes.find((row) => row.id === input.ticketTypeId);
    if (!type) throw new TicketError(404, "Type de billet introuvable");
    await lockTicketType(tx, type.id);
    const lockedType = await tx.ticketType.findUnique({
      where: { id: type.id },
    });
    if (!lockedType) throw new TicketError(404, "Type de billet introuvable");
    if (lockedType.soldCount + qty > lockedType.quota) {
      throw new TicketError(409, "Plus de billets disponibles");
    }
    if (event.capacity != null) {
      const sold = await tx.ticket.count({
        where: {
          eventId: event.id,
          status: { in: ["PAID", "CHECKED_IN"] },
        },
      });
      if (sold + qty > event.capacity) {
        throw new TicketError(409, "Capacité de l’événement atteinte");
      }
    }

    const currency = eventCurrency(event.currency);
    const unit = platformTicketCut({
      priceCents: lockedType.priceCents,
      mode: event.platformFeeMode,
      bps: event.platformFeeBps,
      flatCents: event.platformFeeCents,
    });
    const total = lockedType.priceCents * qty;
    let debit;
    try {
      debit = await debitWalletWithFx(
        tx,
        input.buyerUserId,
        currency,
        total,
        {
          fxCdfPerUsd: event.fxCdfPerUsd,
          fxKwPerUsd: event.fxKwPerUsd,
        },
        `TIX-FX-${event.id.slice(0, 8)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("Solde insuffisant")) {
        throw new TicketError(
          402,
          "Solde insuffisant — convertis ou recharge dans la devise du billet (taux de l’événement appliqué)",
        );
      }
      throw new TicketError(400, message || "Paiement impossible");
    }

    await tx.ticketType.update({
      where: { id: lockedType.id },
      data: { soldCount: { increment: qty } },
    });

    const tickets = [];
    for (let i = 0; i < qty; i += 1) {
      const stubId = `tmp-${i}`;
      const created = await tx.ticket.create({
        data: {
          eventId: event.id,
          typeId: lockedType.id,
          buyerUserId: input.buyerUserId,
          status: "PAID",
          currency,
          purchaseCents: lockedType.priceCents,
          platformFeeCents: unit.platformFeeCents,
          organizerCents: unit.organizerCents,
          qrPayload: stubId,
          qrHmac: stubId,
          code: mintTicketCode(),
        },
      });
      const hmac = signTicketHmac(created.id);
      const qrPayload = buildTicketQrPayload(created.id, hmac);
      const ticket = await tx.ticket.update({
        where: { id: created.id },
        data: { qrPayload, qrHmac: hmac },
        include: ticketInclude,
      });
      await tx.walletTransaction.create({
        data: {
          walletId: debit.wallet.id,
          type: "PURCHASE",
          amountCents: -lockedType.priceCents,
          currency,
          balanceAfterCents: debit.nextCents,
          provider: PURCHASE_PROVIDER,
          status: "SUCCESS",
          reference: `TIX-${ticket.id}`,
          metadata: {
            kind: "ticket",
            eventId: event.id,
            ticketId: ticket.id,
            split: "buyer",
          },
        },
      });
      await ensureTreasury(tx);
      if (unit.platformFeeCents > 0) {
        await creditTreasury(tx, {
          amountCents: unit.platformFeeCents,
          currency,
          kind: "TICKET",
          ticketId: ticket.id,
          actorUserId: input.buyerUserId,
        });
      }
      if (unit.organizerCents > 0) {
        await tx.platformTreasury.update({
          where: { id: "chipshop" },
          data: {
            [currency === "CDF"
              ? "cdfCents"
              : currency === "KW"
                ? "kwCents"
                : "usdCents"]: { increment: unit.organizerCents },
          },
        });
        await writeAudit(tx, {
          ...input.audit,
          action: "TICKET_ORGANIZER_HOLD",
          detail: {
            ticketId: ticket.id,
            eventId: event.id,
            organizerCents: unit.organizerCents,
            currency,
          },
        });
      }
      tickets.push(ticket);
    }

    await writeAudit(tx, {
      ...input.audit,
      action: "TICKET_PURCHASE",
      detail: {
        eventId: event.id,
        ticketTypeId: lockedType.id,
        qty,
        total,
        currency,
      },
    });

    return {
      tickets: tickets.map((row) => publicTicket(row)),
      count: tickets.length,
      chargedCents: total,
      currency,
    };
  });
}

export async function refundTicket(input: {
  ticketId: string;
  actorUserId: string;
  reason: string;
  audit: AuditCtx;
}) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: input.ticketId },
      include: { event: true, type: true },
    });
    if (!ticket) throw new TicketError(404, "Billet introuvable");
    if (ticket.status === "REFUNDED" || ticket.status === "VOID") {
      throw new TicketError(409, "Billet déjà remboursé");
    }
    if (ticket.status === "CHECKED_IN") {
      throw new TicketError(409, "Billet déjà scanné — non remboursable");
    }
    const currency = eventCurrency(ticket.currency);

    if (ticket.settledAt) {
      try {
        await debitWalletLocked(
          tx,
          ticket.event.organizerUserId,
          currency,
          ticket.organizerCents,
        );
      } catch {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { clawbackFailed: true },
        });
        throw new TicketError(
          409,
          "Solde organisateur insuffisant pour reprendre la part",
        );
      }
      const organizerWallet = await tx.wallet.findUnique({
        where: { userId: ticket.event.organizerUserId },
      });
      if (organizerWallet && ticket.organizerCents > 0) {
        await tx.walletTransaction.create({
          data: {
            walletId: organizerWallet.id,
            type: "ADJUSTMENT",
            amountCents: -ticket.organizerCents,
            currency,
            provider: PURCHASE_PROVIDER,
            status: "SUCCESS",
            reference: `TIX-CLAW-${ticket.id}`,
            metadata: {
              kind: "ticket",
              ticketId: ticket.id,
              split: "organizer",
            },
          },
        });
      }
    } else if (ticket.organizerCents > 0) {
      await debitTreasury(tx, {
        amountCents: ticket.organizerCents,
        currency,
        actorUserId: input.actorUserId,
        action: "TICKET_ORGANIZER_HOLD_RELEASE",
        detail: { ticketId: ticket.id },
      });
    }

    await reverseTicketFee(tx, ticket.id);
    const credit = await creditWalletLocked(
      tx,
      ticket.buyerUserId,
      currency,
      ticket.purchaseCents,
    );
    await tx.walletTransaction.create({
      data: {
        walletId: credit.wallet.id,
        type: "REFUND",
        amountCents: ticket.purchaseCents,
        currency,
        balanceAfterCents: credit.nextCents,
        provider: PURCHASE_PROVIDER,
        status: "SUCCESS",
        reference: `TIX-REF-${ticket.id}`,
        metadata: { kind: "ticket", ticketId: ticket.id, reason: input.reason },
      },
    });
    await tx.ticketType.update({
      where: { id: ticket.typeId },
      data: { soldCount: { decrement: 1 } },
    });
    await tx.ticket.update({
      where: { id: ticket.id },
      data: { status: "REFUNDED" },
    });
    await writeAudit(tx, {
      ...input.audit,
      action: "TICKET_REFUND",
      detail: { ticketId: ticket.id, reason: input.reason },
    });
    return { ok: true as const };
  });
}

export async function cancelEventAndRefund(input: {
  eventId: string;
  actorUserId: string;
  audit: AuditCtx;
}) {
  const event = await prisma.event.findUnique({ where: { id: input.eventId } });
  if (!event) throw new TicketError(404, "Événement introuvable");
  if (event.status === "CANCELLED") {
    throw new TicketError(409, "Événement déjà annulé");
  }
  const open = await prisma.ticket.findMany({
    where: { eventId: input.eventId, status: "PAID" },
    select: { id: true },
  });
  for (const row of open) {
    await refundTicket({
      ticketId: row.id,
      actorUserId: input.actorUserId,
      reason: "event_cancelled",
      audit: input.audit,
    });
  }
  await prisma.event.update({
    where: { id: input.eventId },
    data: { status: "CANCELLED" },
  });
  return { refunded: open.length };
}

export async function settleEvent(input: {
  eventId: string;
  actorUserId: string;
  audit: AuditCtx;
}) {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { id: input.eventId } });
    if (!event) throw new TicketError(404, "Événement introuvable");
    if (event.status === "CANCELLED") {
      throw new TicketError(409, "Événement annulé");
    }
    const now = Date.now();
    const gate = event.accessStartsAt ?? event.startsAt;
    if (gate.getTime() > now) {
      throw new TicketError(409, "Trop tôt pour verser l’organisateur");
    }
    const pending = await tx.ticket.findMany({
      where: {
        eventId: event.id,
        status: { in: ["PAID", "CHECKED_IN"] },
        settledAt: null,
      },
    });
    const currency = eventCurrency(event.currency);
    let released = 0;
    for (const ticket of pending) {
      if (ticket.organizerCents > 0) {
        await debitTreasury(tx, {
          amountCents: ticket.organizerCents,
          currency,
          actorUserId: input.actorUserId,
          action: "TICKET_ORGANIZER_SETTLE_DEBIT",
          detail: { ticketId: ticket.id },
        });
        const credit = await creditWalletLocked(
          tx,
          event.organizerUserId,
          currency,
          ticket.organizerCents,
        );
        await tx.walletTransaction.create({
          data: {
            walletId: credit.wallet.id,
            type: "ESCROW_RELEASE",
            amountCents: ticket.organizerCents,
            currency,
            balanceAfterCents: credit.nextCents,
            provider: PURCHASE_PROVIDER,
            status: "SUCCESS",
            reference: `TIX-OUT-${ticket.id}`,
            metadata: {
              kind: "ticket",
              ticketId: ticket.id,
              split: "organizer",
            },
          },
        });
      }
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { settledAt: new Date() },
      });
      released += 1;
    }
    await tx.event.update({
      where: { id: event.id },
      data: {
        settledAt: new Date(),
        status: event.status === "ON_SALE" ? event.status : event.status,
      },
    });
    await writeAudit(tx, {
      ...input.audit,
      action: "TICKET_SETTLE",
      detail: { eventId: event.id, released },
    });
    return { released };
  });
}

export async function checkInTicket(input: {
  payload: string;
  actorUserId: string;
  parsed: { ticketId: string; hmac: string };
}) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.findUnique({
      where: { id: input.parsed.ticketId },
      include: {
        event: true,
        type: true,
        buyer: { select: { id: true, name: true } },
      },
    });
    if (!ticket || ticket.qrHmac !== input.parsed.hmac) {
      throw new TicketError(404, "QR invalide");
    }
    if (ticket.status === "REFUNDED" || ticket.status === "VOID") {
      throw new TicketError(409, "Billet remboursé");
    }
    if (ticket.status === "CHECKED_IN") {
      throw new TicketError(409, "Déjà scanné");
    }
    if (!isAccessWindowOpen(ticket.event)) {
      throw new TicketError(409, "Hors fenêtre d’accès");
    }
    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        checkedInById: input.actorUserId,
      },
    });
    return {
      ok: true as const,
      ticket: {
        id: updated.id,
        code: updated.code,
        type: ticket.type.name,
        buyerName: ticket.buyer.name,
        eventTitle: ticket.event.title,
        checkedInAt: updated.checkedInAt?.toISOString() ?? null,
      },
    };
  });
}
