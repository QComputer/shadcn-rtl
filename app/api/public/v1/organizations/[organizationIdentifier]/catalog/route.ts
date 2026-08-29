import { NextRequest } from "next/server";
import { catalogHandler } from "@/lib/public-catalog/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string }> };
export const GET = (request: NextRequest, context: Context) => catalogHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => catalogHandler(request, context, true);
