import { NextRequest } from "next/server";
import { productHandoffHandler } from "@/lib/public-handoff/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string; externalId: string }> };
export const GET = (request: NextRequest, context: Context) => productHandoffHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => productHandoffHandler(request, context);
