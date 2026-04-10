import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db"; 
// DELETE /api/images/[id]
export async function DELETE(
  request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
  const { id } = await params;

  // Ensure params.id is correctly passed and parsed
  if (!id) {
    return NextResponse.json({ error: "Invalid ID provided" }, { status: 400 });
  }
  // 1. Find the image in the database
  const image = await prisma.image.findUnique({ where: { id } });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // 2. Delete the file from the file system
  try {
    // Construct the full path to the file
    // Make sure the path logic aligns with how files are saved in your upload route
    const filename = image.url.split("/").pop(); // Get filename from URL
    if (!filename) {
      throw new Error("Could not extract filename from URL");
    }
    const filepath = path.join(process.cwd(), "public", "uploads", filename); // Adjust "uploads" if your save path is different
    await fs.unlink(filepath);
  } catch (error: any) {
    console.error("Error deleting file:", error);
    // It's important to decide how to handle file deletion errors.
    // If the DB record is deleted but the file remains, it's a cleanup issue.
    // If the file deletion fails, you might not want to delete the DB record.
    // For now, returning an error, but consider the desired behavior.
    return NextResponse.json(
      { error: `Failed to delete file: ${error.message}` },
      { status: 500 },
    );
  }

  // 3. Delete the record from the database
  try {
    await prisma.image.delete({ where: { id } });
    return NextResponse.json({ message: "Image deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting image from DB:", error);
    return NextResponse.json(
      { error: `Failed to delete image from database: ${error.message}` },
      { status: 500 },
    );
  }
}
