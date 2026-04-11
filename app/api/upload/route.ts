import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db"; // Assuming prisma is correctly set up

export const runtime = "nodejs"; // Recommended for file uploads

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Define the upload directory relative to the project root
    const uploadDir = path.join(process.cwd(), "uploads");

    // Ensure the directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate a unique filename
    const filename = `${Date.now()}-${file.name}`;
    const filepath = path.join(uploadDir, filename);

    // Write the file to the specified directory
    await fs.writeFile(filepath, buffer);

    // The URL to access the image will be handled by your separate route handler
    const url = `/uploads/${filename}`;

    // Save record in DB (assuming prisma.image.create is correctly implemented)
    const image = await prisma.image.create({
      data: { url, filename },
    });

    return NextResponse.json(image, { status: 201 }); // Use 201 for created resources
  } catch (error) {
    console.error("File upload failed:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
