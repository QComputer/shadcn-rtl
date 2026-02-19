import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { serviceService } from "@/lib/services/category.service";
import { createServiceSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const params: Record<string, string | boolean | undefined> = {};
    if (searchParams.get("page")) params.page = parseInt(searchParams.get("page")!);
    if (searchParams.get("pageSize")) params.pageSize = parseInt(searchParams.get("pageSize")!);
    if (searchParams.get("categoryId")) params.categoryId = searchParams.get("categoryId")!;
    if (searchParams.get("isActive")) params.isActive = searchParams.get("isActive") === "true";
    if (searchParams.get("search")) params.search = searchParams.get("search")!;

    const services = await serviceService.list(organizationId, params);

    return NextResponse.json(services);
  } catch (error) {
    console.error("Error listing services:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "service:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createServiceSchema.parse(body);

    const { organizationId, ...serviceData } = body;
    
    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const service = await serviceService.create(organizationId, {
      ...serviceData,
      ...data,
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
