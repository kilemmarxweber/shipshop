export const ANDROID_PACKAGE = "com.kilemmarxweber.ShipShop";

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

const SHARED_PATH = /^\/(product|shop|live)\/([A-Za-z0-9_-]{1,80})$/;

const BOT_UA =
  /bot|spider|crawler|slurp|facebookexternalhit|facebot|googlebot|bingbot|linkedinbot|twitterbot|telegrambot|slackbot|discordbot|google-inspectiontool|headlesschrome|googleassociationservice/i;

export function sharedAppPath(pathname: string) {
  const path =
    pathname.length > 1 && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  const match = SHARED_PATH.exec(path);
  if (!match) return null;
  return `/${match[1]}/${match[2]}`;
}

export function isAndroidHandset(userAgent: string) {
  if (!/Android/i.test(userAgent)) return false;
  if (!/Mozilla\//.test(userAgent)) return false;
  if (BOT_UA.test(userAgent)) return false;
  return true;
}

export function androidIntentUrl(path: string) {
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://${path.slice(1)}#Intent;scheme=shipshop;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

export type ShareVisit = {
  method: string;
  pathname: string;
  web: boolean;
  userAgent: string;
  rsc: boolean;
  prefetch: boolean;
  accept: string;
  secFetchDest: string | null;
};

export type ShareDecision = "open-app" | "website" | "skip";

export function androidShareDecision(visit: ShareVisit): ShareDecision {
  if (visit.method !== "GET" && visit.method !== "HEAD") return "skip";
  if (!sharedAppPath(visit.pathname)) return "skip";
  if (!isAndroidHandset(visit.userAgent)) return "skip";
  if (visit.rsc || visit.prefetch) return "website";
  if (visit.accept.includes("text/x-component")) return "website";
  if (visit.secFetchDest && visit.secFetchDest !== "document") return "website";
  if (visit.web) return "website";
  return "open-app";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function installPageHtml(path: string) {
  const intent = escapeHtml(androidIntentUrl(path));
  const site = escapeHtml(`${path}?web=1`);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="robots" content="noindex" />
  <title>Ouvrir ShipShop</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
      background: #0A0A0F;
      color: #fff;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    main { width: min(100%, 420px); }
    h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.2; font-weight: 700; }
    p { margin: 0 0 24px; color: #A0A0B0; font-size: 16px; line-height: 1.45; }
    a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      margin-top: 12px;
      border-radius: 14px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 700;
    }
    .primary { background: #00D68F; color: #0A0A0F; }
    .secondary { color: #fff; border: 1px solid rgba(127,127,140,0.22); }
  </style>
</head>
<body>
  <main>
    <h1>Ouvre ShipShop</h1>
    <p>Ce lien s’ouvre dans l’application Android. Si ShipShop n’est pas installée, le Play Store te propose de l’installer.</p>
    <a class="primary" href="${intent}">Ouvrir ou installer</a>
    <a class="secondary" href="${site}">Continuer sur le site</a>
  </main>
  <script>location.replace(${JSON.stringify(androidIntentUrl(path))})</script>
</body>
</html>`;
}
