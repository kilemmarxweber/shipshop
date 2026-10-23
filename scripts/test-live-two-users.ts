/**
 * Test live à 2 users : host démarre → abonné reçoit cloche + GET live OK.
 * Usage: pnpm exec tsx scripts/test-live-two-users.ts
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { notifySubscribersLiveStarted } from "../src/lib/growth/live-notify";
import { listCreatorSubscriberIds } from "../src/lib/growth/subscribers";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const HOST_EMAIL = process.env.SEED_EMAIL?.trim() || "demo@chipshop.cd";
const HOST_PASS = process.env.SEED_PASSWORD?.trim() || "demo12345";
const VIEWER_EMAIL = "viewer-live@chipshop.cd";
const VIEWER_PASS = "demo12345";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function cookieHeader(setCookie: string | null) {
  if (!setCookie) return "";
  // Node fetch may join multiple Set-Cookie with comma — keep name=value pairs
  return setCookie
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: BASE,
      Referer: `${BASE}/`,
    },
    body: JSON.stringify({ email, password }),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const fallback = res.headers.get("set-cookie");
  const cookie =
    raw.length > 0
      ? raw.map((c) => c.split(";")[0]).join("; ")
      : cookieHeader(fallback);
  const data = (await res.json().catch(() => ({}))) as {
    user?: { id: string; name: string; email: string };
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok || !cookie) {
    throw new Error(
      `sign-in ${email} → ${res.status} ${data.error?.message ?? data.message ?? JSON.stringify(data)} cookie=${cookie ? "yes" : "no"}`,
    );
  }
  return { cookie, user: data.user! };
}

async function ensureViewer() {
  let user = await prisma.user.findUnique({ where: { email: VIEWER_EMAIL } });
  if (!user) {
    const password = await hashPassword(VIEWER_PASS);
    user = await prisma.user.create({
      data: {
        name: "Viewer Live",
        email: VIEWER_EMAIL,
        emailVerified: true,
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password,
      },
    });
    console.log("✓ viewer créé", VIEWER_EMAIL);
  } else {
    console.log("✓ viewer existant", VIEWER_EMAIL);
  }
  return user;
}

async function main() {
  console.log("— Test live 2 users —");
  console.log("BASE", BASE);

  const host = await prisma.user.findUnique({ where: { email: HOST_EMAIL } });
  if (!host) throw new Error(`Host introuvable: ${HOST_EMAIL} (lance pnpm db:seed)`);
  const viewer = await ensureViewer();

  // Follow host (abonné → cloche)
  await prisma.userFollow.upsert({
    where: {
      followerId_creatorId: {
        followerId: viewer.id,
        creatorId: host.id,
      },
    },
    create: { followerId: viewer.id, creatorId: host.id },
    update: {},
  });
  const subs = await listCreatorSubscriberIds(host.id);
  console.log(`✓ follow ${viewer.email} → ${host.email} (abonnés host: ${subs.length})`);

  const hostAuth = await signIn(HOST_EMAIL, HOST_PASS);
  console.log("✓ sign-in host", hostAuth.user.email);

  // End previous lives
  await prisma.creatorLive.updateMany({
    where: { userId: host.id, status: { in: ["LIVE", "PAUSED"] } },
    data: { status: "ENDED", endedAt: new Date(), endReason: "host" },
  });

  const startRes = await fetch(`${BASE}/api/growth/lives`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: hostAuth.cookie,
    },
    body: JSON.stringify({ title: "Test live 2 users" }),
  });
  const startJson = (await startRes.json()) as {
    live?: { id: string; title: string; status: string };
    error?: string;
  };
  if (!startRes.ok || !startJson.live) {
    throw new Error(`POST live → ${startRes.status} ${startJson.error ?? ""}`);
  }
  const live = startJson.live;
  console.log("✓ live démarré", live.id, live.status);

  // Attendre fan-out notif (fire-and-forget côté API)
  await new Promise((r) => setTimeout(r, 800));
  // Sécurité : relancer notify si l’API a raté (idempotent-ish createMany)
  const n = await notifySubscribersLiveStarted({
    hostUserId: host.id,
    hostName: host.name,
    liveId: live.id,
    liveTitle: live.title,
  });
  console.log(`✓ notices fan-out (relance test): ${n}`);

  const notices = await prisma.appNotice.findMany({
    where: {
      userId: viewer.id,
      href: `/live/${live.id}`,
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log(
    notices.length
      ? `✓ cloche viewer: « ${notices[0]!.title} » → ${notices[0]!.href}`
      : "✗ pas de notice pour le viewer",
  );

  const viewerAuth = await signIn(VIEWER_EMAIL, VIEWER_PASS);
  console.log("✓ sign-in viewer", viewerAuth.user.email);

  const getRes = await fetch(`${BASE}/api/growth/lives/${live.id}`, {
    headers: { Cookie: viewerAuth.cookie },
  });
  const getJson = (await getRes.json()) as {
    live?: { id: string; status: string; title: string };
    error?: string;
  };
  if (!getRes.ok || !getJson.live) {
    throw new Error(`GET live → ${getRes.status} ${getJson.error ?? ""}`);
  }
  console.log("✓ viewer accède au live", getJson.live.status, getJson.live.title);

  const surfaceRes = await fetch(`${BASE}/api/growth/surface`, {
    headers: { Cookie: viewerAuth.cookie },
  });
  const surface = (await surfaceRes.json()) as {
    lives?: { id: string; followedByMe?: boolean; title: string }[];
  };
  const teaser = surface.lives?.find((l) => l.id === live.id);
  console.log(
    teaser
      ? `✓ surface: live visible, followedByMe=${teaser.followedByMe}`
      : "✗ live absent de /api/growth/surface",
  );

  console.log("\nOK — lien à ouvrir:", `${BASE}/live/${live.id}`);
  console.log(`  host:   ${HOST_EMAIL} / ${HOST_PASS}`);
  console.log(`  viewer: ${VIEWER_EMAIL} / ${VIEWER_PASS}`);
}

main()
  .catch((e) => {
    console.error("FAIL", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
