import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

/** Bump when schema fields change so HMR doesn't keep a stale PrismaClient. */
const PRISMA_SCHEMA_REV = 13;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  prismaSchemaRev: number | undefined;
};

function createPrismaClient() {
  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString: process.env.DATABASE_URL!,
      // Prisma local Postgres recommends keeping the pool small.
      max: 10,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  const existing = globalForPrisma.prisma;
  // Recreate if HMR kept a client generated before schema changes.
  if (
    existing &&
    globalForPrisma.prismaSchemaRev === PRISMA_SCHEMA_REV &&
    typeof existing.cartItem?.findMany === "function" &&
    typeof existing.sellerKyc?.findMany === "function" &&
    typeof existing.mediaModerationEvent?.findMany === "function"
  ) {
    return existing;
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  }
  return client;
}

export const prisma = getPrismaClient();

function isTransientDbError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2039" || error.code === "P1017")
  ) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("08P01") ||
    message.includes("prepared statement") ||
    message.includes("bind message")
  );
}

/** Retry flaky local Prisma Postgres / pooler bind errors. */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw lastError;
}
