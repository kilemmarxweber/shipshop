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
  init: RequestInit & {
    idempotencyKey: string;
    replayScope?:
      | "MOVEMENT"
      | "WITHDRAW"
      | "CHECKOUT"
      | "ORDER"
      | "GIFT"
      | "TICKET";
  },
): Promise<{ res: Response; data: T }> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Idempotency-Key", init.idempotencyKey);
  const { idempotencyKey, replayScope, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers });
  } catch {
    const replayUrl =
      !replayScope || replayScope === "MOVEMENT"
        ? `/api/wallet/movements?idempotencyKey=${encodeURIComponent(idempotencyKey)}`
        : `/api/payments/replay?scope=${encodeURIComponent(replayScope)}&key=${encodeURIComponent(idempotencyKey)}`;
    const replay = await fetch(replayUrl);
    if (replay.ok) {
      const json = (await replay.json()) as { movement?: T } & T;
      const data = (json.movement ?? json) as T;
      return { res: replay, data };
    }
    throw new Error("Connexion interrompue — vérifiez l’état du paiement");
  }
  const data = (await res.json()) as T;
  return { res, data };
}
