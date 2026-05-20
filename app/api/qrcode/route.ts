import { NextRequest, NextResponse } from "next/server";
import path from "path";
import QRCode from "qrcode";
import fs from "fs/promises";
import prisma from "@/lib/db";
import { ApiError, jsonError, requireAuthSession, requireRole } from "@/lib/api-guards";

function validateHttpUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Only http and https URLs are allowed");
    }
    return url.toString();
  } catch {
    throw new ApiError(400, "A valid http(s) URL is required");
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = validateHttpUrl(req.nextUrl.searchParams.get("url") || "");
    const qrCodeImageBuffer = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
    });

    const arrayBuffer = qrCodeImageBuffer.buffer.slice(
      qrCodeImageBuffer.byteOffset,
      qrCodeImageBuffer.byteOffset + qrCodeImageBuffer.byteLength,
    ) as BodyInit;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    return jsonError(error, "Failed to generate QR code");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuthSession();
    requireRole(session, ["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]);

    const body = await request.json();
    const url = validateHttpUrl(body?.url || "");

    const qrCodeImageBuffer = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "H",
      margin: 2,
    });

    const uploadDir = path.join(process.cwd(), "../uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const filename = `${Date.now()}-${crypto.randomUUID()}-qrcode.png`;
    const filepath = path.join(uploadDir, filename);
    await fs.writeFile(filepath, Buffer.from(qrCodeImageBuffer), { flag: "wx" });

    const imageUrl = `/uploads/${filename}`;
    const image = await prisma.image.create({
      data: { url: imageUrl, filename },
    });

    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    console.error("Error creating QR code:", error);
    return jsonError(error, "Failed to create qrcode");
  }
}
