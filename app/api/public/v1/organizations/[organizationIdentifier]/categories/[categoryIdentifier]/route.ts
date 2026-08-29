import { NextRequest } from "next/server";
import { categoryHandler } from "@/lib/public-catalog/route-handlers.server";

type Context = { params: Promise<{ organizationIdentifier: string; categoryIdentifier: string }> };
export const GET = (request: NextRequest, context: Context) => categoryHandler(request, context);
export const HEAD = (request: NextRequest, context: Context) => categoryHandler(request, context, true);
