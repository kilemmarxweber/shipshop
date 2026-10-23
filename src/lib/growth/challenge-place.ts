export const CHALLENGE_TEMPLATES = [
  "split",
  "poster",
  "stack",
  "ribbon",
  "pulse",
] as const;
export type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];
export type ChallengeSurface = "feed" | "discover";

export type ChallengeCardModel = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  completions: number;
  done: boolean;
  coverUrl?: string | null;
  coverCandidates?: string[];
  participants?: { name: string; image: string | null }[];
};

export type MixedRow<T> =
  | { kind: "item"; item: T; key: string }
  | {
      kind: "challenge";
      challenge: ChallengeCardModel;
      template: ChallengeTemplate;
      key: string;
    };

export type ChallengeWeaveMemory = {
  seed: string;
  first: number | null;
  gap: number | null;
  assigned: Map<number, string>;
};

export function emptyWeaveMemory(seed = ""): ChallengeWeaveMemory {
  return { seed, first: null, gap: null, assigned: new Map() };
}

function hashSeed(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function templateFor(
  challengeId: string,
  occurrence: number,
): ChallengeTemplate {
  return CHALLENGE_TEMPLATES[
    (hashSeed(challengeId) + occurrence) % CHALLENGE_TEMPLATES.length
  ]!;
}

function densityPlan(seed: string, surface: ChallengeSurface) {
  const startHash = hashSeed(seed);
  const gapHash = hashSeed(`${seed}:gap`);
  const band = startHash % 3;
  if (surface === "feed") {
    const first =
      band === 0 ? 2 + (startHash % 3) : band === 1 ? 4 + (startHash % 4) : 6 + (startHash % 5);
    return { first, gap: 5 + (gapHash % 3) };
  }
  const first =
    band === 0 ? 3 + (startHash % 3) : band === 1 ? 5 + (startHash % 3) : 8 + (startHash % 5);
  return { first, gap: 8 + (gapHash % 4) };
}

function lockPlan(
  memory: ChallengeWeaveMemory,
  seed: string,
  count: number,
  surface: ChallengeSurface,
) {
  if (memory.seed !== seed) {
    memory.seed = seed;
    memory.first = null;
    memory.gap = null;
    memory.assigned = new Map();
  }
  if (count < 3) return;
  if (memory.first != null && memory.gap != null) return;
  const plan = densityPlan(seed, surface);
  if (plan.first > count) {
    if (count < 8) return;
    memory.first = Math.max(2, count - 1);
    memory.gap = plan.gap;
    return;
  }
  memory.first = Math.max(2, plan.first);
  memory.gap = plan.gap;
}

function challengeSlots(
  memory: ChallengeWeaveMemory,
  count: number,
  surface: ChallengeSurface,
) {
  const slots: number[] = surface === "feed" ? [0] : [];
  if (memory.first == null || memory.gap == null) return slots;
  for (let index = memory.first; index <= count; index += memory.gap) {
    if (index !== 0) slots.push(index);
  }
  return slots;
}

function pickOpenChallenge(
  open: ChallengeCardModel[],
  assigned: Map<number, string>,
  slot: number,
) {
  if (open.length === 0) return null;
  const already = [...assigned.entries()]
    .filter(([index]) => index !== slot)
    .map(([, id]) => id);
  const unused = open.filter((row) => !already.includes(row.id));
  const pool = unused.length > 0 ? unused : open;
  const offset = already.length;
  return pool[offset % pool.length] ?? null;
}

export function weaveChallenges<T>(
  items: T[],
  challenges: ChallengeCardModel[],
  itemKey: (item: T, index: number) => string,
  seed: string,
  memory: ChallengeWeaveMemory = emptyWeaveMemory(seed),
  surface: ChallengeSurface = "discover",
): MixedRow<T>[] {
  lockPlan(memory, seed, items.length, surface);
  const byId = new Map(challenges.map((row) => [row.id, row]));
  const open = challenges.filter((row) => !row.done);
  const slots = new Set(challengeSlots(memory, items.length, surface));

  const rows: MixedRow<T>[] = [];

  const insertChallenge = (slot: number) => {
    const keptId = memory.assigned.get(slot);
    const kept = keptId ? byId.get(keptId) : undefined;
    const keep =
      kept &&
      !kept.done &&
      (slot !== 0 || open.some((row) => row.id === kept.id));
    const challenge = keep
      ? kept
      : pickOpenChallenge(open, memory.assigned, slot);
    if (!challenge) return;
    if (!memory.assigned.has(slot) || memory.assigned.get(slot) !== challenge.id) {
      memory.assigned.set(slot, challenge.id);
    }
    const occurrence = [...memory.assigned.values()].filter(
      (id) => id === challenge.id,
    ).length;
    rows.push({
      kind: "challenge",
      challenge,
      template: templateFor(challenge.id, slot + occurrence),
      key: `challenge:${challenge.id}:${slot}`,
    });
  };

  for (let index = 0; index < items.length; index += 1) {
    if (slots.has(index)) insertChallenge(index);
    rows.push({
      kind: "item",
      item: items[index]!,
      key: itemKey(items[index]!, index),
    });
  }

  if (slots.has(items.length)) insertChallenge(items.length);

  return rows;
}
