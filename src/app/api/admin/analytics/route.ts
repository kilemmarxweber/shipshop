import { prisma, withDbRetry } from "@/lib/prisma";
import { requirePlatformSession } from "@/lib/tickets/auth";
import { NextResponse } from "next/server";
import { z } from "zod";

type Experiment = {
  id: string;
  name: string;
  hypothesis: string;
  status: "draft" | "running" | "stopped";
  variantA: { label: string; conversionRate: number };
  variantB: { label: string; conversionRate: number };
  liftPct: number;
  updatedAt: string;
};

type RetentionPolicy = {
  id: string;
  label: string;
  retentionDays: number;
  eligibleEstimate: number;
  mode: "simulate" | "purge";
  nextRunAt: string | null;
  status: "idle" | "planned" | "running" | "error";
};

const EXPERIMENTS_KEY = "admin.analytics.experiments";
const RETENTION_KEY = "admin.analytics.retention";

const memoryStore = new Map<string, unknown>();

async function readJsonConfig<T>(key: string, fallback: T): Promise<T> {
  return (memoryStore.get(key) as T | undefined) ?? fallback;
}

async function writeJsonConfig<T>(key: string, value: T) {
  memoryStore.set(key, value);
  return value;
}

function defaultExperiments(): Experiment[] {
  return [
    {
      id: "exp_wanted_cta",
      name: "CTA Je cherche",
      hypothesis: "Un hero CTA augmente les demandes Wanted",
      status: "running",
      variantA: { label: "Version A", conversionRate: 0.082 },
      variantB: { label: "Version B", conversionRate: 0.124 },
      liftPct: 4.2,
      updatedAt: new Date().toISOString(),
    },
  ];
}

function defaultRetention(): RetentionPolicy[] {
  const next = new Date(Date.now() + 24 * 3_600_000).toISOString();
  return [
    {
      id: "tmp_files",
      label: "Fichiers temporaires",
      retentionDays: 7,
      eligibleEstimate: 0,
      mode: "simulate",
      nextRunAt: next,
      status: "planned",
    },
    {
      id: "old_logs",
      label: "Logs techniques anciens",
      retentionDays: 30,
      eligibleEstimate: 0,
      mode: "simulate",
      nextRunAt: next,
      status: "planned",
    },
    {
      id: "expired_sessions",
      label: "Sessions expirées",
      retentionDays: 14,
      eligibleEstimate: 0,
      mode: "simulate",
      nextRunAt: next,
      status: "planned",
    },
  ];
}

export async function GET(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;

  const tab = new URL(req.url).searchParams.get("tab") ?? "ab";
  const experiments =
    (await readJsonConfig(EXPERIMENTS_KEY, defaultExperiments())) ??
    defaultExperiments();
  const retention =
    (await readJsonConfig(RETENTION_KEY, defaultRetention())) ??
    defaultRetention();

  let expiredSessions = 0;
  try {
    expiredSessions = await withDbRetry(() =>
      prisma.session.count({ where: { expiresAt: { lt: new Date() } } }),
    );
  } catch {
    expiredSessions = 0;
  }

  const retentionWithCounts = retention.map((row) =>
    row.id === "expired_sessions"
      ? { ...row, eligibleEstimate: expiredSessions }
      : row,
  );

  await withDbRetry(() =>
    prisma.cisAdminAudit.create({
      data: {
        actorUserId: auth.session!.user.id,
        action: "analytics.view",
        meta: { tab },
      },
    }),
  ).catch(() => undefined);

  return NextResponse.json({
    tab,
    experiments,
    retention: retentionWithCounts,
  });
}

const patchSchema = z.object({
  action: z.enum([
    "stop_experiment",
    "start_experiment",
    "set_retention_mode",
    "run_retention_simulate",
  ]),
  experimentId: z.string().optional(),
  policyId: z.string().optional(),
  mode: z.enum(["simulate", "purge"]).optional(),
});

export async function PATCH(req: Request) {
  const auth = await requirePlatformSession();
  if (auth.error) return auth.error;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const experiments = await readJsonConfig(
    EXPERIMENTS_KEY,
    defaultExperiments(),
  );
  const retention = await readJsonConfig(RETENTION_KEY, defaultRetention());

  if (
    (body.action === "stop_experiment" || body.action === "start_experiment") &&
    body.experimentId
  ) {
    const next = experiments.map((row) =>
      row.id === body.experimentId
        ? {
            ...row,
            status:
              body.action === "stop_experiment"
                ? ("stopped" as const)
                : ("running" as const),
            updatedAt: new Date().toISOString(),
          }
        : row,
    );
    await writeJsonConfig(EXPERIMENTS_KEY, next);
  }

  if (body.action === "set_retention_mode" && body.policyId && body.mode) {
    if (body.mode === "purge") {
      return NextResponse.json(
        {
          error:
            "Purge réelle désactivée en MVP — utilisez simulate jusqu’à validation MOA.",
        },
        { status: 400 },
      );
    }
    const next = retention.map((row) =>
      row.id === body.policyId ? { ...row, mode: body.mode! } : row,
    );
    await writeJsonConfig(RETENTION_KEY, next);
  }

  if (body.action === "run_retention_simulate") {
    const next = retention.map((row) => ({
      ...row,
      status: "planned" as const,
      nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
    }));
    await writeJsonConfig(RETENTION_KEY, next);
  }

  await withDbRetry(() =>
    prisma.cisAdminAudit.create({
      data: {
        actorUserId: auth.session!.user.id,
        action: `analytics.${body.action}`,
        meta: body,
      },
    }),
  ).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
