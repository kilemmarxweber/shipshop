import { readFileSync } from "node:fs";
import { AccessToken } from "livekit-server-sdk";

const t = readFileSync(".env", "utf8");
const get = (k) => {
  const m = t.match(new RegExp(`^${k}=(.*)$`, "m"));
  return (m?.[1] ?? "").trim().replace(/^['"]|['"]$/g, "");
};

const url = get("LIVEKIT_URL");
const key = get("LIVEKIT_API_KEY");
const secret = get("LIVEKIT_API_SECRET");
const flag = get("NEXT_PUBLIC_LIVE_SFU");
const masked = /[•\u2022]/.test(secret) || /^•+$/.test(secret);

const base = {
  urlHost: url.replace(/^wss:\/\//, "").split("/")[0] || null,
  keyPrefix: key.slice(0, 6) || null,
  secretLen: secret.length,
  secretMasked: masked,
  nextPublicLiveSfu: flag,
};

if (
  !url.startsWith("wss://") ||
  !key.startsWith("API") ||
  secret.length < 20 ||
  masked
) {
  console.log(JSON.stringify({ ...base, ok: false, reason: "env_invalid" }, null, 2));
  process.exit(1);
}

try {
  const at = new AccessToken(key, secret, {
    identity: "env-check",
    ttl: "2m",
  });
  at.addGrant({
    room: "env-check",
    roomJoin: true,
    canSubscribe: true,
    canPublish: false,
  });
  const token = await at.toJwt();
  console.log(
    JSON.stringify(
      {
        ...base,
        ok: true,
        tokenMinted: Boolean(token && token.split(".").length === 3),
        sfuWouldEnable: true,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.log(
    JSON.stringify(
      {
        ...base,
        ok: false,
        reason: "token_mint_failed",
        error: e instanceof Error ? e.message : String(e),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
