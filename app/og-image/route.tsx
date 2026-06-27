import { ImageResponse } from "next/og";

const size = {
  width: 1200,
  height: 630,
};

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f172a",
          color: "#f8fafc",
          padding: 72,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: "#f59e0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#111827",
              fontSize: 48,
              fontWeight: 900,
            }}
          >
            B
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: 0 }}>Bazar Baz</div>
            <div style={{ color: "#cbd5e1", fontSize: 28 }}>Commerce and appointment booking</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ maxWidth: 920, fontSize: 54, fontWeight: 800, lineHeight: 1.08 }}>
            Discover shops, services, products, and booking pages.
          </div>
          <div style={{ color: "#fde68a", fontSize: 30 }}>bazar-baz.ir</div>
        </div>
      </div>
    ),
    size,
  );
}
