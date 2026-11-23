import { prisma, withDbRetry } from "@/lib/prisma";
import {
  DEFAULT_FEE_SETTINGS,
  type PlatformFeeSettingsRow,
} from "@/lib/platform-fee-math";

export * from "@/lib/platform-fee-math";

let settingsCache: { at: number; value: PlatformFeeSettingsRow } | null = null;
const SETTINGS_TTL_MS = 5_000;

export function invalidatePlatformFeeSettingsCache() {
  settingsCache = null;
}

export async function ensurePlatformFeeSettings() {
  return withDbRetry(() =>
    prisma.platformFeeSettings.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
    }),
  );
}

export async function getPlatformFeeSettings(): Promise<PlatformFeeSettingsRow> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.at < SETTINGS_TTL_MS) {
    return settingsCache.value;
  }
  try {
    const row = await ensurePlatformFeeSettings();
    settingsCache = { at: now, value: row };
    return row;
  } catch {
    return DEFAULT_FEE_SETTINGS;
  }
}
