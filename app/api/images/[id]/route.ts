import { NextResponse, NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db"; // Assuming prisma is correctly set up

// DELETE /api/images/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params; // Directly get id from params

  // Ensure ID is valid
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
    // Extract filename from the stored URL
    // Assuming image.url is like "/uploads/1678886400000-myimage.jpg"
    const filename = image.url.split("/").pop();
    if (!filename) {
      // This case should ideally not happen if your URL is correctly formatted
      throw new Error("Could not extract filename from URL");
    }

    // Construct the full path to the file in the custom 'uploads' directory
    // process.cwd() gives the project root. We join it with "uploads" and the filename.
    const filepath = path.join(process.cwd(), "uploads", filename);

    // Check if the file actually exists before attempting to delete
    await fs.access(filepath, fs.constants.F_OK); // Throws if file doesn't exist
    await fs.unlink(filepath); // Delete the file

    //console.log(`Successfully deleted file: ${filepath}`);
  } catch (error: any) {
    console.error(`Error deleting file ${image.url}:`, error);

    // Decide on error handling:
    // If file deletion fails but DB record exists, it's a cleanup issue.
    // For now, we'll still attempt to delete the DB record, but log the file deletion error.
    // If you want to prevent DB deletion on file error, return here:
    // return NextResponse.json({ error: `Failed to delete file: ${error.message}` }, { status: 500 });
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
