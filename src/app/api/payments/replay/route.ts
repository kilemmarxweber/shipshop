import {
    findIdempotentOp,
    type IdempotencyScope,
} from "@/lib/payments/idempotent-op";
import { parseIdempotencyKey } from "@/lib/payments/ledger";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";

const SCOPES = new Set<IdempotencyScope>([
  "WITHDRAW",
  "CHECKOUT",
  "ORDER",
  "GIFT",
  "TICKET",
]);

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") as IdempotencyScope | null;
  const key = url.searchParams.get("key");
  if (!scope || !SCOPES.has(scope)) {
    return NextResponse.json({ error: "Scope invalide" }, { status: 400 });
  }

  try {
    parseIdempotencyKey(key);
  } catch {
    return NextResponse.json({ error: "Clé invalide" }, { status: 400 });
  }

  const row = await findIdempotentOp({
    userId: session.user.id,
    scope,
    key: key!,
  });
  if (!row || row.status !== "COMPLETED" || row.response == null) {
    return NextResponse.json(
      { error: "Opération introuvable" },
      { status: 404 },
    );
  }

  return NextResponse.json(row.response, {
    status: row.httpStatus || 200,
    headers: { "x-idempotent-replay": "1" },
  });
}
