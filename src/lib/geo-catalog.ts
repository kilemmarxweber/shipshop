import { KINSHASA_CITY, KINSHASA_COMMUNES } from "@/lib/kinshasa-geo";
import { prisma, withDbRetry } from "@/lib/prisma";

export type GeoCommuneCatalog = {
  name: string;
  quartiers: string[];
  avenues: string[];
};

export function foldGeo(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mergeUnique(base: string[], extra: string[]) {
  const out = [...base];
  const seen = new Set(base.map(foldGeo));
  for (const item of extra) {
    const t = item.trim();
    if (t.length < 2) continue;
    const key = foldGeo(t);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function seedFor(commune: string) {
  const key = foldGeo(commune);
  return KINSHASA_COMMUNES.find((c) => foldGeo(c.name) === key);
}

export async function listKinshasaCatalog(): Promise<{
  city: string;
  communes: GeoCommuneCatalog[];
}> {
  const zones = await withDbRetry(() =>
    prisma.deliveryZone.findMany({
      where: { isActive: true },
      orderBy: { commune: "asc" },
    }),
  );

  const needsBackfill = zones.some(
    (z) => z.quartiers.length === 0 && z.avenues.length === 0,
  );
  if (needsBackfill && zones.length > 0) {
    await Promise.all(
      zones.map(async (z) => {
        const seed = seedFor(z.commune);
        if (!seed) return;
        const quartiers = mergeUnique(z.quartiers, seed.quartiers);
        const avenues = mergeUnique(z.avenues, seed.avenues);
        if (
          quartiers.length === z.quartiers.length &&
          avenues.length === z.avenues.length
        ) {
          return;
        }
        await withDbRetry(() =>
          prisma.deliveryZone.update({
            where: { id: z.id },
            data: { quartiers, avenues },
          }),
        );
      }),
    );
  }

  const fresh = needsBackfill
    ? await withDbRetry(() =>
        prisma.deliveryZone.findMany({
          where: { isActive: true },
          orderBy: { commune: "asc" },
        }),
      )
    : zones;

  const byName = new Map<string, GeoCommuneCatalog>();
  for (const z of fresh) {
    const seed = seedFor(z.commune);
    byName.set(foldGeo(z.commune), {
      name: z.commune,
      quartiers: mergeUnique(z.quartiers, seed?.quartiers ?? []),
      avenues: mergeUnique(z.avenues, seed?.avenues ?? []),
    });
  }
  for (const seed of KINSHASA_COMMUNES) {
    const key = foldGeo(seed.name);
    if (byName.has(key)) continue;
    byName.set(key, {
      name: seed.name,
      quartiers: seed.quartiers,
      avenues: seed.avenues,
    });
  }

  return {
    city: KINSHASA_CITY,
    communes: [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    ),
  };
}

export async function saveGeoTerms(input: {
  commune: string;
  quartier?: string;
  avenue?: string;
  lat?: number | null;
  lng?: number | null;
}): Promise<{ city: string; communes: GeoCommuneCatalog[] }> {
  const commune = input.commune.trim().slice(0, 80);
  const quartier = (input.quartier ?? "").trim().slice(0, 80);
  const avenue = (input.avenue ?? "").trim().slice(0, 80);
  if (commune.length < 2) {
    return listKinshasaCatalog();
  }

  const existing = await withDbRetry(() =>
    prisma.deliveryZone.findFirst({
      where: { commune: { equals: commune, mode: "insensitive" } },
    }),
  );

  const seed = seedFor(existing?.commune ?? commune);
  const quartiers = mergeUnique(
    existing?.quartiers ?? seed?.quartiers ?? [],
    quartier ? [quartier] : [],
  );
  const avenues = mergeUnique(
    existing?.avenues ?? seed?.avenues ?? [],
    avenue ? [avenue] : [],
  );

  if (existing) {
    await withDbRetry(() =>
      prisma.deliveryZone.update({
        where: { id: existing.id },
        data: { quartiers, avenues, isActive: true },
      }),
    );
  } else {
    const lat = input.lat ?? -4.33;
    const lng = input.lng ?? 15.31;
    await withDbRetry(() =>
      prisma.deliveryZone.create({
        data: {
          commune,
          name: `Périphérie ${commune}`,
          kind: "REMOTE",
          baseCents: 500,
          ratePerKmCents: 100,
          centerLat: lat,
          centerLng: lng,
          quartiers,
          avenues,
        },
      }),
    );
  }

  return listKinshasaCatalog();
}
