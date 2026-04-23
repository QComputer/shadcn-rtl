import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateOrganizationSettingsSchema } from "@/lib/validators";
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
    if (session.user.name === "superadmin") {
      const sadmin = await prisma.user.update({
        where: { id: session.user.id },
        data: {
          role: "SUPER_ADMIN",
        },
        include: {
          memberOf: true
        }
      });

      if(sadmin.memberOf)
        {await prisma.organizationMember.delete({
          where: { userId: sadmin.memberOf.id },
        });}
      return 
    }
    const organizationSlug = (session.user.role == "SUPER_ADMIN") ?  await getSlug(id) : (session.user.organizationId) ? await getSlug(session.user.organizationId) : null ;

    if (!organizationSlug) return;
    let settings = await prisma.organizationSettings.findUnique({
      where: { organizationSlug },
      include: {
        organization: {
          include: { businessHours: true },
        },
      },
    });

    if (!settings){
    settings = await prisma.organizationSettings.create({
    data: { organizationSlug },
    include: {
      organization: {
        include: {
          businessHours: true,
        },
      },
    },
  });
    }

    return NextResponse.json(settings || {});
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

    const body = await request.json();
    const data = updateOrganizationSettingsSchema.parse(body) as any;
    const organizationSlug =
      session.user.role == "SUPER_ADMIN"
        ? await getSlug(id)
        : session.user.organizationId
          ? await getSlug(session.user.organizationId)
          : null;
    if (!organizationSlug) return;
    const settings = await prisma.organizationSettings.upsert({
      where: { organizationSlug },
      update: data,
      create: {
        organizationSlug,
        ...data,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
