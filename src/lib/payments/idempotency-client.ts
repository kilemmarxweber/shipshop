const STORAGE_PREFIX = "chipshop.pay.idem.";

export function paymentIdempotencyKey(intent: string) {
  if (typeof window === "undefined") return crypto.randomUUID();
  const slot = STORAGE_PREFIX + intent;
  const existing = sessionStorage.getItem(slot);
  if (existing) return existing;
  const next = crypto.randomUUID();
  sessionStorage.setItem(slot, next);
  return next;
}

export function clearPaymentIdempotencyKey(intent: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_PREFIX + intent);
}

export async function fetchPaymentJson<T>(
  url: string,
  init: RequestInit & { idempotencyKey: string },
): Promise<{ res: Response; data: T }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", init.idempotencyKey);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    const replay = await fetch(
      `/api/wallet/movements?idempotencyKey=${encodeURIComponent(init.idempotencyKey)}`,
    );
    if (replay.ok) {
      const json = (await replay.json()) as { movement?: T };
      if (json.movement) {
        return {
          res: new Response(JSON.stringify(json.movement), { status: 200 }),
          data: json.movement,
        };
      }
    }
    throw new Error("Connexion interrompue — vérifiez l’état du paiement");
  }
  const data = (await res.json()) as T;
  return { res, data };
}
