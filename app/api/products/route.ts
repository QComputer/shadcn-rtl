import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { productService } from "@/lib/services/product.service";
import { createProductSchema, productFilterSchema } from "@/lib/validators";
import { normalizePagination } from "@/lib/pagination";
import {
  ApiError,
  jsonError,
  requireAuthSession,
  requireCurrentOrganizationId,
  getActiveMembership,
} from "@/lib/api-guards";
import { requireActiveOrganizationCapability } from "@/lib/organization-capabilities.server";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const pagination = normalizePagination(searchParams, { maxPageSize: 100 });

    const sanitizedParams: Record<string, unknown> = {
      ...searchParams,
      page: pagination.page,
      pageSize: pagination.pageSize,
    };

    for (const key of ["isActive", "inStock"] as const) {
      if (sanitizedParams[key] === "true") sanitizedParams[key] = true;
      if (sanitizedParams[key] === "false") sanitizedParams[key] = false;
      if (sanitizedParams[key] === "") sanitizedParams[key] = undefined;
    }

    for (const key of ["minPrice", "maxPrice"] as const) {
      const value = sanitizedParams[key];
      if (typeof value === "string") {
        const numericValue = Number(value);
        sanitizedParams[key] = Number.isFinite(numericValue) ? numericValue : undefined;
      }
    }

    const params = productFilterSchema.parse(sanitizedParams);

    if (!session || session.user?.role === "CUSTOMER") {
      params.isActive = true;
    }

    if (session?.user?.role && !["SUPER_ADMIN", "CUSTOMER"].includes(session.user.role)) {
      if (!session.user.organizationId) {
        throw new ApiError(403, "Forbidden");
      }
      const membership = await getActiveMembership(
        session.user.id,
        session.user.organizationId,
      );

      if (!membership || !membership.organization.isActive || membership.organization.deletedAt) {
        return NextResponse.json({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
      }

      if (params.organizationId && params.organizationId !== membership.organizationId) {
        throw new ApiError(403, "Forbidden");
      }

      params.organizationId = membership.organizationId;
    }

    const products =
      session?.user?.role === "SUPER_ADMIN"
        ? await productService.listAll(params)
        : await productService.list(params);

    return NextResponse.json(products);
  } catch (error) {
    console.error("Error listing products:", error);
    return jsonError(error, "Internal server error");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    const body = await request.json();
    const organizationId = await requireCurrentOrganizationId(
      session,
      body.organizationId ?? session.user.organizationId,
    );
    await requireActiveOrganizationCapability({ organizationId, capability: "SHOP" });

    const data = createProductSchema.parse({ ...body, organizationId });
    const product = await productService.create(data, organizationId, session.user.role);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error creating product:", error);
    return jsonError(error, "Internal server error");
  }
}
