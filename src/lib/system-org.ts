import { prisma, withDbRetry } from "@/lib/prisma";

export const SYSTEM_ORG_SLUG = "chipshop";
export const SYSTEM_ORG_NAME = "Chip Shop";

/** Organisation plateforme unique — tous les vendeurs y sont membres. */
export async function ensureSystemOrganization(ownerUserId?: string) {
  return withDbRetry(async () => {
    let org = await prisma.organization.findUnique({
      where: { slug: SYSTEM_ORG_SLUG },
    });

    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: SYSTEM_ORG_NAME,
          slug: SYSTEM_ORG_SLUG,
          metadata: JSON.stringify({ system: true }),
        },
      });
    }

    if (ownerUserId) {
      const existing = await prisma.member.findFirst({
        where: { organizationId: org.id, userId: ownerUserId },
      });
      if (!existing) {
        await prisma.member.create({
          data: {
            organizationId: org.id,
            userId: ownerUserId,
            role: "owner",
          },
        });
      } else if (existing.role !== "owner") {
        // keep first owner; ignore
      }
    }

    return org;
  });
}

/** Rattache un vendeur à l'org système (role member) s'il n'y est pas déjà. */
export async function ensureSellerMembership(userId: string) {
  const org = await ensureSystemOrganization();
  const member = await withDbRetry(() =>
    prisma.member.findFirst({
      where: { organizationId: org.id, userId },
    }),
  );
  if (member) return { org, member };

  const created = await withDbRetry(() =>
    prisma.member.create({
      data: {
        organizationId: org.id,
        userId,
        role: "member",
      },
    }),
  );
  return { org, member: created };
}
