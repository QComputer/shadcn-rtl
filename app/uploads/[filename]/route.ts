// app/uploads/[filename]/route.ts
import { NextResponse, NextRequest } from "next/server";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";

export const runtime = "nodejs";

export async function GET(
request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;


  // NOW try to access params.filename
  // We need to ensure params and params.filename are actually there
  if (!filename) {
    console.error("Missing filename in params");
    return new NextResponse("Bad Request: Missing filename", { status: 400 });
  }

  const filePath = path.join(process.cwd(), "uploads", filename);
  console.log(`Attempting to serve file: ${filePath}`);

  try {
    if (!fs.existsSync(filePath)) {
      console.error(`File not found at: ${filePath}`);
      return new NextResponse("File not found", { status: 404 });
    }

    const fileContent = await fsp.readFile(filePath);
    let mimeType = "application/octet-stream";
    const ext = path.extname(filename).toLowerCase(); // Use params.filename here too
    // ... (rest of your MIME type logic) ...

    return new NextResponse(fileContent, {
      status: 200,
      headers: { "Content-Type": mimeType },
    });
  } catch (error) {
    console.error(
      `Error serving file ${filename} at ${filePath}:`,
      error,
    );
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
