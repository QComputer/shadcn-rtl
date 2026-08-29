import { NextRequest } from "next/server";
import { productHandler } from "@/lib/public-catalog/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string; productIdentifier: string }> };
export const GET = (request: NextRequest, context: Context) => productHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => productHandler(request, context, true);
