import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { listPublicDemoShowcases } from "@/lib/demo-universe/demo-public.service";

export async function GET() {
  try {
    return NextResponse.json({ showcases: await listPublicDemoShowcases() });
  } catch (error) {
    return jsonError(error);
  }
}
