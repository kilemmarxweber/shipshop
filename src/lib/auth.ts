import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { isPlatformRole, orgAccessControl, orgRoles } from "@/lib/org-access";
import { emailFromPhone, isPhoneBackedEmail } from "@/lib/auth-register";
import { looksLikeEmail, normalizeAccountPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureMembership } from "@/lib/system-org";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const phone = normalizeAccountPhone(String(ctx.body?.phone ?? ""));
        if (!phone) {
          throw new APIError("BAD_REQUEST", {
            message: "Numéro de téléphone invalide",
            code: "PHONE_INVALID",
          });
        }
        const taken = await prisma.user.findFirst({
          where: { phone },
          select: { id: true },
        });
        if (taken) {
          throw new APIError("CONFLICT", {
            message: "Ce numéro est déjà utilisé",
            code: "PHONE_TAKEN",
          });
        }
        const emailRaw = String(ctx.body?.email ?? "").trim().toLowerCase();
        let email = emailRaw;
        if (!email || isPhoneBackedEmail(email)) {
          email = emailFromPhone(phone);
        } else if (!looksLikeEmail(email)) {
          throw new APIError("BAD_REQUEST", {
            message: "E-mail invalide",
            code: "EMAIL_INVALID",
          });
        }
        return {
          context: {
            ...ctx,
            body: { ...ctx.body, phone, email },
          },
        };
      }
      if (ctx.path === "/sign-in/email") {
        const raw = String(ctx.body?.email ?? "").trim();
        if (raw.includes("@")) {
          const email = raw.toLowerCase();
          if (isPhoneBackedEmail(email) || !looksLikeEmail(email)) {
            throw new APIError("BAD_REQUEST", {
              message: "E-mail invalide",
              code: "EMAIL_INVALID",
            });
          }
          return {
            context: {
              ...ctx,
              body: { ...ctx.body, email },
            },
          };
        }
        const phone = normalizeAccountPhone(raw);
        if (!phone) {
          throw new APIError("BAD_REQUEST", {
            message: "Numéro de téléphone invalide",
            code: "PHONE_INVALID",
          });
        }
        const user = await prisma.user.findFirst({
          where: { phone },
          select: { email: true },
        });
        if (!user?.email) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid email or password",
          });
        }
        return {
          context: {
            ...ctx,
            body: { ...ctx.body, email: user.email },
          },
        };
      }
    }),
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
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { disabledAt: true },
          });
          if (user?.disabledAt) {
            throw new APIError("FORBIDDEN", {
              message: "Compte désactivé — contenu interdit",
              code: "ACCOUNT_DISABLED",
            });
          }
          return { data: session };
        },
        after: async (session) => {
          await ensureMembership(session.userId);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
