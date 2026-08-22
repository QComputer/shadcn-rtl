import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, requireAuthSession } from "@/lib/api-guards";
import { requireTenantContext } from "@/lib/tenant-context";
import {
  createExternalCatalogConnection,
  listExternalCatalogConnections,
} from "@/lib/external-catalog/external-catalog.service";

const createSchema = z.object({
  provider: z.enum(["SNAPPFOOD", "EZY", "MANUAL_IMPORT", "FUTURE_PROVIDER"]),
  externalUrl: z.string().url().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    return NextResponse.json({ connections: await listExternalCatalogConnections({ organizationId: id }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuthSession();
    const { id } = await params;
    await requireTenantContext(session, id, ["ADMIN", "MANAGER"]);
    const body = createSchema.parse(await request.json());
    return NextResponse.json({
      connection: await createExternalCatalogConnection({
        organizationId: id,
        provider: body.provider,
        externalUrl: body.externalUrl ?? null,
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
