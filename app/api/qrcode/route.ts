import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
// Import Buffer from 'buffer' if you are in a Node.js environment
// In Next.js app router, this is usually implicitly available, but explicit import can help.

// This API route will generate a QR code image for a given URL
export async function GET(req: NextRequest) {
  const shopUrl = req.nextUrl.searchParams.get('url');

  if (!shopUrl) {
    return new NextResponse(
      JSON.stringify({ error: 'URL parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Generate QR code as a PNG buffer
    const qrCodeImageBuffer = await QRCode.toBuffer(shopUrl, {
      type: "png", // Specify image type as PNG
      errorCorrectionLevel: "H", // High error correction
      margin: 2,
    });

    // NextResponse can accept a Buffer directly in modern Next.js versions
    // If you encounter issues, explicitly convert to ArrayBuffer or Uint8Array
    // Example:
    const arrayBuffer = qrCodeImageBuffer.buffer.slice(
      qrCodeImageBuffer.byteOffset,
      qrCodeImageBuffer.byteOffset + qrCodeImageBuffer.byteLength,
    ) as BodyInit;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png", // Set content type to PNG
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Failed to generate QR code' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
