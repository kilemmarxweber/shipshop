import assert from "node:assert/strict";
import { CIS_EVENT_TYPES } from "./constants";
import { isCisEventType } from "./events";

for (const type of CIS_EVENT_TYPES) {
  assert.equal(isCisEventType(type), true);
}
assert.equal(isCisEventType("unknown"), false);
assert.equal(isCisEventType(null), false);

console.log("cis-events.test.ts ok");
