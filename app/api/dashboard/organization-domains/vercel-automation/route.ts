import { NextResponse } from "next/server";
import { getVercelDomainAutomationState } from "@/lib/vercel-domain-automation";

export async function GET() {
  try {
    const state = getVercelDomainAutomationState();
    return NextResponse.json({ state });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load Vercel automation state" }, { status: 500 });
  }
}
