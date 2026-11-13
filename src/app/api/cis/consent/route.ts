import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CIS_DEFAULT_SCOPES,
  CIS_POLICY_VERSION,
} from "@/lib/cis/constants";
import {
  eraseCisUserData,
  getLatestCisConsent,
  isCisConsentStatus,
  recordCisConsent,
} from "@/lib/cis/consent";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const latest = await getLatestCisConsent(session.user.id);
  return NextResponse.json({
    policyVersion: CIS_POLICY_VERSION,
    defaultScopes: [...CIS_DEFAULT_SCOPES],
    consent: latest
      ? {
          status: latest.status,
          policyVersion: latest.policyVersion,
          scopes: latest.scopes,
          decidedAt: latest.decidedAt.toISOString(),
          withdrawnAt: latest.withdrawnAt?.toISOString() ?? null,
        }
      : null,
  });
}

const bodySchema = z.object({
  status: z.enum(["accepted", "refused", "withdrawn"]),
  policyVersion: z.string().min(1).max(40).optional(),
  scopes: z.array(z.string().min(1).max(64)).max(12).optional(),
  eraseData: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  if (!isCisConsentStatus(body.status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const consent = await recordCisConsent({
    userId: session.user.id,
    status: body.status,
    policyVersion: body.policyVersion,
    scopes: body.scopes,
  });

  if (
    (body.status === "withdrawn" || body.status === "refused") &&
    body.eraseData !== false
  ) {
    await eraseCisUserData(session.user.id);
  }

  return NextResponse.json({
    ok: true,
    consent: {
      status: consent.status,
      policyVersion: consent.policyVersion,
      scopes: consent.scopes,
      decidedAt: consent.decidedAt.toISOString(),
      withdrawnAt: consent.withdrawnAt?.toISOString() ?? null,
    },
  });
}
