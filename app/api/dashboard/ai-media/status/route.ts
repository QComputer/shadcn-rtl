import { NextResponse } from "next/server";

export async function GET() {
  const enabled = process.env.AI_MEDIA_SERVICE_ENABLED === "true";
  return NextResponse.json({ enabled });
}
