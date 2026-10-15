import { NextRequest, NextResponse } from "next/server";
import { requireAuthSession, requireRole, ApiError } from "@/lib/api-guards";
import { prisma } from "@/lib/db";
import { provisioningError } from "@/lib/tenant-provisioning/http";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);
    const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";
    if (query.length < 3 || query.length > 254) throw new ApiError(400, "نام کاربری یا ایمیل را وارد کنید");
    const users = await prisma.user.findMany({ where: { role: "CUSTOMER", isActive: true, deletedAt: null, emailVerified: { not: null },
      OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { equals: query, mode: "insensitive" } }],
    }, select: { id: true, name: true, email: true }, take: 10, orderBy: { name: "asc" } });
    const items = [];
    for (const user of users) if (user.email && await prisma.emailVerification.findFirst({ where: { userId: user.id, email: user.email, verifiedAt: { not: null, lte: new Date() } }, select: { id: true } })) items.push(user);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return provisioningError(error); }
}
