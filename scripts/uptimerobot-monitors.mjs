/**
 * Crée les moniteurs UptimeRobot manquants (web, /api/health, /api/ready).
 * La clé reste hors Git : UPTIMEROBOT_API_KEY.
 *
 *   UPTIMEROBOT_API_KEY=... node scripts/uptimerobot-monitors.mjs
 *   UPTIMEROBOT_API_KEY=... SHIPSHOP_PUBLIC_URL=https://shipshop.klambocore.com node scripts/uptimerobot-monitors.mjs
 */
const apiKey = process.env.UPTIMEROBOT_API_KEY?.trim();
const origin = (
  process.env.SHIPSHOP_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://shipshop.klambocore.com"
)
  .trim()
  .replace(/\/$/, "");

const monitors = [
  { friendly_name: "ShipShop Web", url: origin },
  { friendly_name: "ShipShop Health", url: `${origin}/api/health` },
  { friendly_name: "ShipShop Ready", url: `${origin}/api/ready` },
];

if (!apiKey) {
  console.log(
    "UPTIMEROBOT_API_KEY absent — moniteurs non créés. URLs prévues :",
  );
  for (const monitor of monitors) console.log(`- ${monitor.friendly_name}: ${monitor.url}`);
  process.exit(0);
}

async function uptime(endpoint, fields) {
  const body = new URLSearchParams({ api_key: apiKey, format: "json", ...fields });
  const response = await fetch(`https://api.uptimerobot.com/v2/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json();
  if (data.stat !== "ok") {
    throw new Error(`${endpoint}: ${data.error?.message || response.status}`);
  }
  return data;
}

const existing = await uptime("getMonitors", { logs: "0" });
const known = new Set(
  (existing.monitors ?? []).map((monitor) => String(monitor.url).replace(/\/$/, "")),
);

for (const monitor of monitors) {
  if (known.has(monitor.url)) {
    console.log(`déjà présent : ${monitor.url}`);
    continue;
  }
  await uptime("newMonitor", {
    type: "1",
    url: monitor.url,
    friendly_name: monitor.friendly_name,
    interval: "300",
  });
  console.log(`créé : ${monitor.friendly_name} → ${monitor.url}`);
}
