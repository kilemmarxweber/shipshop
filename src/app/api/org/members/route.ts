import { NextResponse } from "next/server";
import { z } from "zod";
import { assertChipShopOwner } from "@/lib/kyc";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import {
  backfillSystemMemberships,
  ensureMembership,
} from "@/lib/system-org";

const ORG_ROLES = ["member", "admin"] as const;

const patchSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ORG_ROLES),
});

async function requireOrgMember(userId: string) {
  const { org, member } = await ensureMembership(userId);
  return { org, member };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { org, member } = await requireOrgMember(session.user.id);
  await backfillSystemMemberships();
  const { isOwner: isPlatformOwner } = await assertChipShopOwner(
    session.user.id,
  );

  let members = await withDbRetry(() =>
    prisma.member.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            phone: true,
          },
        },
      },
    }),
  );

  // Vendeur : soi-même + personnes qu'il a invitées uniquement.
  // Owner / admin plateforme : toute la liste.
  let pendingInvites: {
    id: string;
    email: string;
    role: string | null;
    status: string;
    createdAt: Date;
  }[] = [];

  if (!isPlatformOwner) {
    const invites = await withDbRetry(() =>
      prisma.invitation.findMany({
        where: { inviterId: session.user.id },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    pendingInvites = invites.filter((i) => i.status === "pending");
    const invitedEmails = new Set(
      invites.map((i) => i.email.trim().toLowerCase()),
    );
    members = members.filter(
      (m) =>
        m.userId === session.user.id ||
        invitedEmails.has(m.user.email.trim().toLowerCase()),
    );
  }

  // Toute boutique (active ou non) = vendeur ; sinon = client / acheteur
  const shopCounts = await withDbRetry(() =>
    prisma.shop.groupBy({
      by: ["ownerUserId"],
      where: {
        organizationId: org.id,
        ownerUserId: { not: null },
      },
      _count: { _all: true },
    }),
  );
  const shopsByUser = new Map(
    shopCounts.map((row) => [row.ownerUserId, row._count._all]),
  );

  return NextResponse.json({
    organizationId: org.id,
    myRole: member.role,
    isOwner: member.role === "owner" || isPlatformOwner,
    isPlatformOwner,
    scope: isPlatformOwner ? "all" : "self_and_invites",
    pendingInvites,
    members: members.map((m) => {
      const shops = shopsByUser.get(m.userId) ?? 0;
      return {
        id: m.id,
        role: m.role,
        userId: m.userId,
        user: m.user,
        shopCount: shops,
        kind: shops > 0 ? "vendor" : "buyer",
        isMe: m.userId === session.user.id,
      };
    }),
  });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { org, member: actor } = await requireOrgMember(session.user.id);
  if (actor.role !== "owner") {
    return NextResponse.json(
      { error: "Seul l'owner peut changer un rôle" },
      { status: 403 },
    );
  }

  try {
    const body = patchSchema.parse(await req.json());
    const target = await withDbRetry(() =>
      prisma.member.findFirst({
        where: { id: body.memberId, organizationId: org.id },
      }),
    );
    if (!target) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (target.role === "owner") {
      return NextResponse.json(
        { error: "Le rôle owner ne peut pas être modifié ici" },
        { status: 400 },
      );
    }
    if (target.userId === session.user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas modifier votre propre rôle" },
        { status: 400 },
      );
    }

    const updated = await withDbRetry(() =>
      prisma.member.update({
        where: { id: target.id },
        data: { role: body.role },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    );

    return NextResponse.json({ member: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Mise à jour impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
