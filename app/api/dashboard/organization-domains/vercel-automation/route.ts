import { NextResponse } from "next/server";
import { getDomainAutomationState } from "@/lib/domain-automation.server";

export async function GET() {
  try {
    const state = getDomainAutomationState();
    return NextResponse.json({ state });
  } catch {
    return NextResponse.json({ error: "Failed to load domain automation state" }, { status: 500 });
  }
}
