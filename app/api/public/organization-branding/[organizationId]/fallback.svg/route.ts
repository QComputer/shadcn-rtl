import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const organization = await prisma.organization.findFirst({ where: { id: organizationId, isActive: true, deletedAt: null }, select: { name: true } });
  if (!organization) return new NextResponse("Not found", { status: 404 });
  const label = (organization.name || "Organization").trim().slice(0, 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#64748B"/><text x="256" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-size="150" font-weight="700" fill="#FFFFFF">${label.replace(/[<>&]/g, "")}</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-cache, max-age=0, must-revalidate" } });
}
