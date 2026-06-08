import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/types";


const getSlug = async (organizationId:string) =>{
const org = await prisma.organization.findUnique({ where: { id: organizationId } });
return org?.slug
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organizationSlug = (session.user.role == "SUPER_ADMIN") ?  await getSlug(id) : (session.user.organizationId) ? await getSlug(session.user.organizationId) : null ;

    if (!organizationSlug) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const paymentSettings = await prisma.paymentSettings.findUnique({
      where: { organizationSlug },
    });

    return NextResponse.json(paymentSettings || {});
  } catch (error) {
    console.error("Error getting settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;
    if (!session?.user?.id || !session?.user?.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId =
      session.user.role === "SUPER_ADMIN"
        ? id
        : session?.user?.organizationId || null;
    if (!organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "org:update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await request.json();
    const organizationSlug =
      session.user.role == "SUPER_ADMIN"
        ? await getSlug(id)
        : session.user.organizationId
          ? await getSlug(session.user.organizationId)
          : null;
    if (!organizationSlug) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const paymentSettings = await prisma.paymentSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: {
        organizationSlug,
        ...data,
      },
    });

    return NextResponse.json(paymentSettings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
