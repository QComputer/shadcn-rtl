import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-guards";
import {
  createExternalCatalogConnection,
  listExternalCatalogConnections,
} from "@/lib/external-catalog/external-catalog.service";
import { resolveDemoSessionContext } from "@/lib/demo-universe/demo-session-context";

const createSchema = z.object({
  provider: z.enum(["SNAPPFOOD", "EZY", "MANUAL_IMPORT", "FUTURE_PROVIDER"]),
  externalUrl: z.string().url().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER", "PLATFORM_ADMIN"] });
    return NextResponse.json({ connections: await listExternalCatalogConnections({ organizationId: context.organizationId }) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await resolveDemoSessionContext({ request, allowedDemoRoles: ["ORGANIZATION_OWNER", "MANAGER"] });
    const body = createSchema.parse(await request.json());
    return NextResponse.json({
      connection: await createExternalCatalogConnection({
        organizationId: context.organizationId,
        provider: body.provider,
        externalUrl: body.externalUrl ?? null,
        metadata: { demoUniverse: true },
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}
