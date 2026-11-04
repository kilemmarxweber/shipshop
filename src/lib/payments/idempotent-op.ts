import { Prisma } from "@/generated/prisma/client";
import { parseIdempotencyKey } from "@/lib/payments/ledger";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export type IdempotencyScope =
  | "WITHDRAW"
  | "CHECKOUT"
  | "ORDER"
  | "GIFT"
  | "TICKET";

type Tx = Prisma.TransactionClient;

export function fingerprintPayload(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

export function snapshotJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  ) as Prisma.InputJsonValue;
}

export function isUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function findIdempotentOp(input: {
  userId: string;
  scope: IdempotencyScope;
  key: string;
}) {
  return prisma.idempotentOperation.findUnique({
    where: {
      userId_scope_clientKey: {
        userId: input.userId,
        scope: input.scope,
        clientKey: parseIdempotencyKey(input.key),
      },
    },
  });
}

const STALE_PENDING_MS = 20_000;

export function replayIfComplete(
  row: {
    status: string;
    requestHash: string;
    httpStatus: number;
    response: Prisma.JsonValue | null;
    updatedAt?: Date;
  } | null,
  requestHash: string,
  opts?: { allowHashMismatch?: boolean },
) {
  if (!row) return null;
  if (row.status === "COMPLETED") {
    if (!opts?.allowHashMismatch && row.requestHash !== requestHash) {
      throw new Error(
        "Clé d’idempotence déjà utilisée pour une autre opération",
      );
    }
    return {
      httpStatus: row.httpStatus || 200,
      response: row.response,
    };
  }
  if (row.status === "PENDING") {
    const updated = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    if (Date.now() - updated < STALE_PENDING_MS) {
      throw new Error("Paiement déjà en cours — une seule commande est créée");
    }
    return null;
  }
  if (!opts?.allowHashMismatch && row.requestHash !== requestHash) {
    throw new Error("Clé d’idempotence déjà utilisée pour une autre opération");
  }
  return null;
}

export async function beginIdempotentInTx(
  tx: Tx,
  input: {
    userId: string;
    scope: IdempotencyScope;
    key: string;
    requestHash: string;
    allowHashMismatch?: boolean;
  },
) {
  const clientKey = parseIdempotencyKey(input.key);
  const existing = await tx.idempotentOperation.findUnique({
    where: {
      userId_scope_clientKey: {
        userId: input.userId,
        scope: input.scope,
        clientKey,
      },
    },
  });
  const replay = replayIfComplete(existing, input.requestHash, {
    allowHashMismatch: input.allowHashMismatch,
  });
  if (replay) return { replayed: true as const, replay };
  if (existing) {
    await tx.idempotentOperation.update({
      where: { id: existing.id },
      data: {
        status: "PENDING",
        requestHash: input.requestHash,
        httpStatus: 0,
        response: Prisma.JsonNull,
      },
    });
    return { replayed: false as const, clientKey };
  }
  await tx.idempotentOperation.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      clientKey,
      requestHash: input.requestHash,
      status: "PENDING",
    },
  });
  return { replayed: false as const, clientKey };
}

export async function completeIdempotentInTx(
  tx: Tx,
  input: {
    userId: string;
    scope: IdempotencyScope;
    key: string;
    httpStatus: number;
    response: unknown;
  },
) {
  await tx.idempotentOperation.update({
    where: {
      userId_scope_clientKey: {
        userId: input.userId,
        scope: input.scope,
        clientKey: parseIdempotencyKey(input.key),
      },
    },
    data: {
      status: "COMPLETED",
      httpStatus: input.httpStatus,
      response: snapshotJson(input.response),
    },
  });
}
