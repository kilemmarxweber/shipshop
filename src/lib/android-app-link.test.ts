import { strict as assert } from "node:assert";

import {
  ANDROID_PACKAGE,
  PLAY_STORE_URL,
  androidIntentUrl,
  androidShareDecision,
  installPageHtml,
  isAndroidHandset,
  sharedAppPath,
} from "./android-app-link";

const chromeAndroid =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const whatsAppAndroid =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1.76";

assert.equal(sharedAppPath("/product/clh123abc"), "/product/clh123abc");
assert.equal(sharedAppPath("/shop/ma-boutique/"), "/shop/ma-boutique");
assert.equal(sharedAppPath("/live/clive1"), "/live/clive1");
assert.equal(sharedAppPath("/shops/admin"), null);
assert.equal(sharedAppPath("/product/../admin"), null);
assert.equal(sharedAppPath("/product/a/b"), null);

assert.equal(isAndroidHandset(chromeAndroid), true);
assert.equal(isAndroidHandset(whatsAppAndroid), true);
assert.equal(isAndroidHandset("WhatsApp/2.24.1"), false);
assert.equal(
  isAndroidHandset(
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  ),
  false,
);
assert.equal(
  isAndroidHandset(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
  ),
  false,
);

const visit = {
  method: "GET",
  pathname: "/product/abc",
  web: false,
  userAgent: chromeAndroid,
  rsc: false,
  prefetch: false,
  accept: "text/html",
  secFetchDest: "document" as string | null,
};

assert.equal(androidShareDecision(visit), "open-app");
assert.equal(androidShareDecision({ ...visit, web: true }), "website");
assert.equal(androidShareDecision({ ...visit, rsc: true }), "website");
assert.equal(
  androidShareDecision({ ...visit, userAgent: "WhatsApp/2.24.1" }),
  "skip",
);
assert.equal(
  androidShareDecision({ ...visit, pathname: "/api/products/abc" }),
  "skip",
);

const intent = androidIntentUrl("/product/abc");
assert.ok(intent.startsWith("intent://product/abc#Intent;scheme=shipshop;"));
assert.ok(intent.includes(`package=${ANDROID_PACKAGE}`));
assert.ok(intent.includes(encodeURIComponent(PLAY_STORE_URL)));

const html = installPageHtml("/live/abc");
assert.ok(html.includes("Ouvrir ou installer"));
assert.ok(html.includes("Continuer sur le site"));
assert.ok(html.includes("/live/abc?web=1"));
assert.ok(html.includes("scheme=shipshop"));
assert.equal(html.includes("<script>location.replace("), true);
