import { NextResponse } from "next/server";
import { getAppConfig, publicAppConfig } from "@/lib/content-source";

export async function GET() {
  const cfg = await getAppConfig();
  return NextResponse.json(publicAppConfig(cfg));
}
