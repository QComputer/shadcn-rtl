import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";

const REQUEST_DEMO_LEAD_STATUSES = [
  "NEW",
  "REVIEWED",
  "CONTACTED",
  "QUALIFIED",
  "REJECTED",
  "ARCHIVED",
] as const;

function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length <= 4) return "****";
  return `******${cleaned.slice(-4)}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN"]);

    const pageParam = request.nextUrl.searchParams.get("page");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const statusParam = request.nextUrl.searchParams.get("status");

    const page = Math.max(Number(pageParam) || 1, 1);
    const limit = Math.min(Math.max(Number(limitParam) || 20, 1), 100);
    const status = statusParam && REQUEST_DEMO_LEAD_STATUSES.includes(statusParam as typeof REQUEST_DEMO_LEAD_STATUSES[number])
      ? (statusParam as typeof REQUEST_DEMO_LEAD_STATUSES[number])
      : undefined;

    const where = status ? { status } : {};

    const [leads, total] = await Promise.all([
      prisma.requestDemoLead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          source: true,
          locale: true,
          fullName: true,
          businessName: true,
          businessType: true,
          phone: true,
          city: true,
          preferredContactTime: true,
          needSummary: true,
          consentAccepted: true,
          createdAt: true,
          updatedAt: true,
          reviewedAt: true,
          adminNote: true,
          reviewedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.requestDemoLead.count({ where }),
    ]);

    const items = leads.map((lead) => ({
      ...lead,
      phone: maskPhone(lead.phone),
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    return jsonError(error, "Failed to fetch request demo leads");
  }
}
