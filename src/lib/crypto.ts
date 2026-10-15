import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptionKeyCandidates(): Buffer[] {
  const secrets = [
    process.env.ENCRYPTION_SECRET,
    process.env.BETTER_AUTH_SECRET,
    "dev-insecure-secret-change-me",
  ].filter((s): s is string => Boolean(s?.trim()));

  const seen = new Set<string>();
  const keys: Buffer[] = [];
  for (const secret of secrets) {
    if (seen.has(secret)) continue;
    seen.add(secret);
    keys.push(keyFromSecret(secret));
  }
  return keys;
}

function getKey(): Buffer {
  return encryptionKeyCandidates()[0]!;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Payload chiffré invalide");
  }

  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  let lastError: unknown;

  for (const key of encryptionKeyCandidates()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      return dec.toString("utf8");
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    "Impossible de déchiffrer le secret (ENCRYPTION_SECRET modifié ?).",
    { cause: lastError },
  );
}

export function maskApiKey(key: string): string {
  if (key.length <= 12) return "••••••••";
  return `${key.slice(0, 8)}…${key.slice(-4)}`;
}
