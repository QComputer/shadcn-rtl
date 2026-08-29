import { NextRequest } from "next/server";
import { productsHandler } from "@/lib/public-catalog/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string }> };
export const GET = (request: NextRequest, context: Context) => productsHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => productsHandler(request, context, true);
