import { createHmac, randomBytes } from "crypto";

export const TICKET_QR_PREFIX = "SHIPSHOP-TIX";

function ticketQrSecret() {
  return (
    process.env.TICKET_QR_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "chipshop-ticket-dev"
  );
}

export function signTicketHmac(ticketId: string) {
  return createHmac("sha256", ticketQrSecret())
    .update(`v1|${ticketId}`)
    .digest("hex")
    .slice(0, 24);
}

export function buildTicketQrPayload(ticketId: string, hmac: string) {
  return `${TICKET_QR_PREFIX}|v1|${ticketId}|${hmac}`;
}

export function parseTicketQrPayload(raw: string) {
  const parts = raw.trim().split("|");
  if (parts[0] !== TICKET_QR_PREFIX || parts[1] !== "v1" || parts.length < 4) {
    return null;
  }
  const ticketId = parts[2]?.trim();
  const hmac = parts[3]?.trim();
  if (!ticketId || !hmac) return null;
  return { ticketId, hmac };
}

export function verifyTicketQrPayload(raw: string) {
  const parsed = parseTicketQrPayload(raw);
  if (!parsed) return null;
  if (parsed.hmac !== signTicketHmac(parsed.ticketId)) return null;
  return parsed;
}

export function mintTicketCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}
