import { auth } from "@/lib/auth";
import prisma from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session || !session.user?.organizationId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const organization = await prisma.organization.update({
        where: {id: session.user?.organizationId},
        data: {isOpen: true}
    })
    console.log("-----api/rganization.GET----------organization", organization);
    
    return NextResponse.json(organization);
}

export async function POST(request: NextRequest) {
       const session = await auth();
       if (!session || !session.user?.organizationId) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
       }
       const body = await request.json();

       const organization = await prisma.organization.update({
         where: { id: session.user?.organizationId },
         data: { isOpen:  body.isOpen},
       });

    console.log("------api/rganization.POST---------organization", organization);

       return NextResponse.json(organization);
}