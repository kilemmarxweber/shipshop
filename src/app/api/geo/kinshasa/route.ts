import { NextResponse } from "next/server";
import { KINSHASA_CITY, KINSHASA_COMMUNES } from "@/lib/kinshasa-geo";

export async function GET() {
  return NextResponse.json({
    city: KINSHASA_CITY,
    communes: KINSHASA_COMMUNES,
  });
}
