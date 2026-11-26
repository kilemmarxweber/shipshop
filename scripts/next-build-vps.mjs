/**
 * Build VPS : saute le typecheck Next (OOM / exit 137 sur ~2 Go RAM)
 * et lance le binaire Next avec un heap plafonné.
 *
 * Usage : pnpm build:vps
 * (ou : node --max-old-space-size=2048 ./scripts/next-build-vps.mjs)
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.SHIPSHOP_BUILD_SKIP_TSC = "1";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
