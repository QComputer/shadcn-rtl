"use client";

import { use, useEffect, useState } from "react";

export default function ShopPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug;
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    // Construct the URL for the API route, passing the shop's public URL
    const shopPublicUrl = `${window.location.origin}/shops/${slug}`;
    const apiUrl = `/api/qrcode?url=${encodeURIComponent(shopPublicUrl)}`;
    setQrCodeUrl(apiUrl);
  }, [slug]);

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>

      <h1>برای دسترسی به منوی فروشگاه کیو آر کد زیر را اسکن کنید</h1>
<div className="p-10 px-20">
      {qrCodeUrl ? (
        <img
          src={qrCodeUrl}
          alt={`QR Code for ${slug} Shop`}
          width={400}
          height={400}
          // Optionally, set priority or loading="eager" if it's a critical element
          // priority
        />
      ) : (
        <p>Loading QR code...</p>
      )}
    </div>
  </div>
  );
}
