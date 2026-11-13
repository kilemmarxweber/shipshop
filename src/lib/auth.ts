import {
    assertLoginAllowed,
    recordLoginFailure,
    recordLoginSuccess,
    requestClientIp,
} from "@/lib/auth-login-security";
import { emailFromPhone, isPhoneBackedEmail } from "@/lib/auth-register";
import { isPlatformRole, orgAccessControl, orgRoles } from "@/lib/org-access";
import { looksLikeEmail, normalizeAccountPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { ensureMembership } from "@/lib/system-org";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { bearer, organization } from "better-auth/plugins";

function trustedOrigins() {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? base).replace(/\/$/, "");
  const extra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return Array.from(
    new Set([
      base,
      app,
      "http://localhost:3000",
      "http://localhost:8081",
      "shipshop://",
      "shipshop://app",
      "exp://",
      "exp://**",
      ...extra,
    ]),
  );
}

function signInSubject(body: unknown) {
  const raw = String(
    body && typeof body === "object" && "email" in body
      ? ((body as { email?: unknown }).email ?? "")
      : "",
  ).trim();
  return raw;
}

export const auth = betterAuth({
  trustedOrigins: trustedOrigins(),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  // Better Auth rate-limit (IP/path) — stockage DB pour multi-instances.
  // Docs: https://www.better-auth.com/docs/concepts/rate-limit (v1.7.x)
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    storage: "database",
    modelName: "rateLimit",
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 20,
      },
      "/sign-up/email": {
        window: 60,
        max: 10,
      },
      "/request-password-reset": {
        window: 60,
        max: 5,
      },
      "/forget-password": {
        window: 60,
        max: 5,
      },
    },
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
        const emailRaw = String(ctx.body?.email ?? "")
          .trim()
          .toLowerCase();
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
        const ip = requestClientIp({
          headers: ctx.headers,
          request: ctx.request,
        });

        // Limitation compte/IP avant vérification du mot de passe.
        const gate = await assertLoginAllowed({
          subjectRaw: raw || "unknown",
          ip,
        });
        if (gate.blocked) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Invalid email or password",
          });
        }

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
        // Réponse générique : ne pas révéler si le numéro existe.
        if (!user?.email) {
          await recordLoginFailure({
            subjectRaw: phone,
            ip,
            userAgent: ctx.headers?.get("user-agent"),
          });
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
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const subject = signInSubject(ctx.body);
      if (!subject) return;
      const ip = requestClientIp({
        headers: ctx.headers,
        request: ctx.request,
      });
      const ua = ctx.headers?.get("user-agent");
      const returned = ctx.context.returned;

      if (isAPIError(returned)) {
        // Échec mot de passe / auth — compter même si le compte n'existe pas
        // (Better Auth renvoie le même UNAUTHORIZED).
        if (
          returned.statusCode === 401 ||
          returned.status === "UNAUTHORIZED" ||
          returned.statusCode === 429
        ) {
          // 429 déjà géré (lock) : ne pas prolonger.
          if (
            returned.statusCode === 429 ||
            returned.status === "TOO_MANY_REQUESTS"
          ) {
            return;
          }
          await recordLoginFailure({
            subjectRaw: subject,
            ip,
            userAgent: ua,
          });
        }
        return;
      }

      // Succès : session créée
      if (returned && typeof returned === "object") {
        await recordLoginSuccess({ subjectRaw: subject, ip });
      }
    }),
  },
  plugins: [
    bearer(),
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
