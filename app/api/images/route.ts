import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const images = await prisma.image.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(images);
}
