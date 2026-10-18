import { readFileSync } from "node:fs";

const raw = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of raw.split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i)] = line.slice(i + 1);
}
const id = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const ds = env.NEXT_PUBLIC_SANITY_DATASET;
const t = env.SANITY_API_READ_TOKEN;
const url = `https://${id}.api.sanity.io/v2021-06-07/data/query/${ds}?query=${encodeURIComponent("*[_type==\"appConfig\"][0]._id")}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
const json = await res.json();
console.log("query", res.status, json.result ?? null, json.error || json.message || "ok");
