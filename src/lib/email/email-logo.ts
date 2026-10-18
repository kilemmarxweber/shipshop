import fs from "fs";
import path from "path";

export const SHIPSHOP_EMAIL_LOGO_CID = "shipshop-logo@shipshop";

function fileExists(filePath: string) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function resolveEmailLogoFilePath(): string | null {
  const fromEnv = process.env.APP_LOGO_URL?.trim();
  if (fromEnv && !fromEnv.startsWith("http")) {
    const relative = fromEnv.replace(/^\//, "");
    const local = path.join(process.cwd(), "public", relative);
    if (fileExists(local)) return local;
  }

  const defaultFile = path.join(process.cwd(), "public", "shipshop-logo.png");
  if (fileExists(defaultFile)) return defaultFile;
  return null;
}

export function getEmailLogoSrc(): string {
  if (resolveEmailLogoFilePath()) {
    return `cid:${SHIPSHOP_EMAIL_LOGO_CID}`;
  }
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://shipshop.klambocore.com"
  ).replace(/\/$/, "");
  return `${origin}/shipshop-logo.png`;
}

export function buildEmailLogoAttachment(): {
  filename: string;
  path: string;
  cid: string;
} | null {
  const logoPath = resolveEmailLogoFilePath();
  if (!logoPath) return null;
  return {
    filename: path.basename(logoPath),
    path: logoPath,
    cid: SHIPSHOP_EMAIL_LOGO_CID,
  };
}
