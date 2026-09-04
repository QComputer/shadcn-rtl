import { NextRequest } from "next/server";
import { productHandoffsHandler } from "@/lib/public-handoff/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string }> };
export const GET = (request: NextRequest, context: Context) => productHandoffsHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => productHandoffsHandler(request, context);
