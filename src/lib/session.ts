import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "better-auth.session_token";

/** Les routes métier lisent le cookie. L'app native envoie le jeton bearer. */
export function sessionHeaders(incoming: Headers) {
  const authorization = incoming.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return incoming;
  const token = authorization.slice(7).trim();
  if (!token || token.includes(";")) return incoming;
  const secure = (process.env.BETTER_AUTH_URL ?? "").startsWith("https://");
  const name = `${secure ? "__Secure-" : ""}${SESSION_COOKIE}`;
  const current = incoming.get("cookie") ?? "";
  const already = current
    .split(";")
    .some((part) => part.trim().startsWith(`${name}=`));
  if (already) return incoming;
  const headers = new Headers(incoming);
  const pair = `${name}=${token}`;
  headers.set("cookie", current ? `${current}; ${pair}` : pair);
  return headers;
}

export async function getSession() {
  return auth.api.getSession({
    headers: sessionHeaders(await headers()),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function requireOrgMember(organizationId: string) {
  const session = await requireSession();
  const member = await prisma.member.findFirst({
    where: {
      organizationId,
      userId: session.user.id,
    },
  });
  if (!member) {
    throw new Error("FORBIDDEN");
  }
  return { session, member };
}

export async function getOrCreateWallet(userId: string) {
  return prisma.wallet.upsert({
    where: { userId },
    create: { userId, balanceCents: 0, currency: "USD" },
    update: {},
  });
}
