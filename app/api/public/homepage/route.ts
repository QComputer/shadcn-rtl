import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getHomepageData } from "@/lib/demo-universe/demo-public.service";

export async function GET() {
  try {
    return NextResponse.json(await getHomepageData());
  } catch (error) {
    return jsonError(error);
  }
}
