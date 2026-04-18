import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, OrganizationType, OrderStatus, AppointmentStatus, User } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("----------------notification route session:", session);
    
    const user = session.user;

    const notifications = await prisma.notification.updateManyAndReturn({
      where: {targetUserId: user.id, seen: false},
      data: {seen: true}
    })
console.log("----------notifications:", notifications);


    // Add user context to response
    return NextResponse.json({
      trigger: (notifications?.length>0),
      notifications
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message: "Internal server error" },
      { status: 500 }
    );
  }
}
