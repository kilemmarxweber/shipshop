import { createHash } from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseIdempotencyKey } from "@/lib/payments/ledger";

export type IdempotencyScope = "WITHDRAW" | "CHECKOUT" | "ORDER" | "GIFT";

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

export function replayIfComplete(
  row: {
    status: string;
    requestHash: string;
    httpStatus: number;
    response: Prisma.JsonValue | null;
  } | null,
  requestHash: string,
) {
  if (!row) return null;
  if (row.requestHash !== requestHash) {
    throw new Error("Clé d’idempotence déjà utilisée pour une autre opération");
  }
  if (row.status === "COMPLETED") {
    return {
      httpStatus: row.httpStatus || 200,
      response: row.response,
    };
  }
  if (row.status === "PENDING") {
    throw new Error("Opération déjà en cours — réessayez dans un instant");
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
  const replay = replayIfComplete(existing, input.requestHash);
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
