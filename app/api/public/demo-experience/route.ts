import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getPublicDemoExperience } from "@/lib/public-experience/demo-experience.service";

export async function GET() {
  try {
    return NextResponse.json(await getPublicDemoExperience());
  } catch (error) {
    return jsonError(error);
  }
}
