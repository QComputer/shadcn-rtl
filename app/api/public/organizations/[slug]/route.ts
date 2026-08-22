import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-guards";
import { getPublicOrganizationReadModel } from "@/lib/public-experience/organization-public-read-model.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    return NextResponse.json(await getPublicOrganizationReadModel(slug));
  } catch (error) {
    return jsonError(error);
  }
}
