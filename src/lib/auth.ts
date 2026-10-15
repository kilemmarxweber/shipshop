import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { isPlatformRole, orgAccessControl, orgRoles } from "@/lib/org-access";
import { prisma } from "@/lib/prisma";
import { ensureMembership } from "@/lib/system-org";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      // Une seule org système (Chip Shop) — les vendeurs s'y rattachent
      allowUserToCreateOrganization: false,
      organizationLimit: 1,
      membershipLimit: 500,
      invitationExpiresIn: 60 * 60 * 24 * 7,
      ac: orgAccessControl,
      roles: orgRoles,
      organizationHooks: {
        async beforeCreateInvitation({ invitation, inviter, organization }) {
          const member = await prisma.member.findFirst({
            where: {
              userId: inviter.id,
              organizationId: organization.id,
            },
          });
          if (!isPlatformRole(member?.role)) {
            return { data: { role: "member" } };
          }
          if (member?.role !== "owner" && invitation.role === "owner") {
            return { data: { role: "admin" } };
          }
        },
      },
      async sendInvitationEmail(data) {
        // V1: log invitation link (no email provider yet)
        const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
        console.log(
          `[invite] ${data.email} → ${base}/auth/accept-invite?invitationId=${data.id}`,
        );
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.wallet.create({
            data: {
              userId: user.id,
              balanceCents: 0,
              currency: "USD",
            },
          });
          await ensureMembership(user.id);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await ensureMembership(session.userId);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
