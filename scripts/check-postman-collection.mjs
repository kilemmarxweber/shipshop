import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const collection = JSON.parse(
  readFileSync(
    new URL("../postman/ShipShop-API.postman_collection.json", import.meta.url),
    "utf8",
  ),
);

const folders = new Set(collection.item.map((folder) => folder.name));
for (const name of [
  "Authentication",
  "Users",
  "Products",
  "Orders",
  "LIVE",
  "Monitoring",
]) {
  assert.ok(folders.has(name), `dossier manquant : ${name}`);
}

const raw = JSON.stringify(collection);
assert.equal(raw.includes("sk_live"), false);
assert.equal(raw.includes("sk_test"), false);
assert.equal(raw.includes("BEGIN PRIVATE"), false);
assert.equal(/Bearer eyJ/i.test(raw), false, "JWT en dur");
assert.equal(raw.includes("{{baseUrl}}/api/health"), true);
assert.equal(raw.includes("{{baseUrl}}/api/ready"), true);
assert.equal(raw.includes("/api/auth/password-reset/request"), true);
assert.equal(raw.includes("/api/auth/password-reset/confirm"), true);
assert.equal(raw.includes("/api/growth/lives/{{liveId}}/sfu-token"), true);
assert.equal(raw.includes("/api/auth/refresh"), false, "pas de refresh token");

const monitoring = collection.item.find((folder) => folder.name === "Monitoring");
assert.equal(monitoring.item.length, 2);
for (const request of monitoring.item) {
  const headers = request.request.header ?? [];
  assert.equal(
    headers.some((header) => /authorization/i.test(header.key)),
    false,
    "Monitoring sans Authorization",
  );
}

console.log("check-postman-collection.mjs OK");
