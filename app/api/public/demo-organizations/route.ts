import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { listPublicDemoOrganizations } from "@/lib/demo-universe/demo-public.service";

export async function GET() {
  try {
    return NextResponse.json({ organizations: await listPublicDemoOrganizations() });
  } catch (error) {
    return jsonError(error);
  }
}
