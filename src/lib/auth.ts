import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

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
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
