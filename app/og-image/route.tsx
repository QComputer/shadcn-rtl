import { ImageResponse } from "next/og";

const size = {
  width: 1200,
  height: 630,
};

const kindLabels = {
  organization: "Organization",
  category: "Category",
  product: "Product",
  service: "Service",
};

const kindColors = {
  organization: { accent: "#f59e0b", panel: "#172554" },
  category: { accent: "#22c55e", panel: "#052e16" },
  product: { accent: "#38bdf8", panel: "#082f49" },
  service: { accent: "#f472b6", panel: "#500724" },
};

function safeParam(searchParams: URLSearchParams, key: string, fallback = "") {
  return (searchParams.get(key) || fallback).replace(/\s+/g, " ").trim();
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = safeParam(searchParams, "kind", "organization") as keyof typeof kindLabels;
  const palette = kindColors[kind] || kindColors.organization;
  const label = kindLabels[kind] || "Bazar Baz";
  const title = safeParam(searchParams, "title", "Bazar Baz");
  const subtitle = safeParam(searchParams, "subtitle", "Commerce and appointment booking");
  const organization = safeParam(searchParams, "organization", "bazar-baz.ir");
  const locale = safeParam(searchParams, "locale", "fa").toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 52%, #020617 100%)",
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
              background: palette.accent,
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
            <div style={{ color: "#cbd5e1", fontSize: 28 }}>{organization}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              alignSelf: "flex-start",
              display: "flex",
              borderRadius: 999,
              background: palette.panel,
              color: palette.accent,
              fontSize: 26,
              fontWeight: 800,
              padding: "12px 22px",
            }}
          >
            {label} - {locale}
          </div>
          <div style={{ maxWidth: 960, fontSize: 58, fontWeight: 900, lineHeight: 1.04 }}>
            {title}
          </div>
          <div style={{ maxWidth: 860, color: "#cbd5e1", fontSize: 30, lineHeight: 1.25 }}>
            {subtitle}
          </div>
          <div style={{ color: "#fde68a", fontSize: 30 }}>bazar-baz.ir</div>
        </div>
      </div>
    ),
    size,
  );
}
