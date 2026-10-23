import { CAMPAIGN_PACKS, type CampaignObjective } from "@/lib/growth/constants";

export function isCampaignObjective(value: string): value is CampaignObjective {
  return value in CAMPAIGN_PACKS;
}

export function packForObjective(objective: CampaignObjective) {
  return CAMPAIGN_PACKS[objective];
}

export function clampPackBudget(objective: CampaignObjective, budgetCents: number) {
  const pack = CAMPAIGN_PACKS[objective];
  return Math.min(pack.maxBudgetCents, Math.max(pack.minBudgetCents, budgetCents));
}

export function packCatalog() {
  return (Object.keys(CAMPAIGN_PACKS) as CampaignObjective[]).map((objective) => {
    const pack = CAMPAIGN_PACKS[objective];
    return {
      objective,
      kind: pack.kind,
      minBudgetCents: pack.minBudgetCents,
      maxBudgetCents: pack.maxBudgetCents,
    };
  });
}
