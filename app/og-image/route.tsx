import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

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

const rtlKindLabels = {
  organization: "سازمان",
  category: "دسته بندی",
  product: "محصول",
  service: "خدمت",
};

const kindColors = {
  organization: { accent: "#f59e0b", panel: "#172554" },
  category: { accent: "#22c55e", panel: "#052e16" },
  product: { accent: "#38bdf8", panel: "#082f49" },
  service: { accent: "#f472b6", panel: "#500724" },
};

let fontPromise: Promise<
  {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700 | 900;
    style: "normal";
  }[]
> | null = null;

function fontData(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function loadFonts() {
  fontPromise ??= Promise.all([
    readFile(join(process.cwd(), "public/fonts/Vazirmatn-Regular.ttf")),
    readFile(join(process.cwd(), "public/fonts/Vazirmatn-Bold.ttf")),
    readFile(join(process.cwd(), "public/fonts/Vazirmatn-Black.ttf")),
  ]).then(([regular, bold, black]) => [
    { name: "Vazirmatn", data: fontData(regular), weight: 400, style: "normal" },
    { name: "Vazirmatn", data: fontData(bold), weight: 700, style: "normal" },
    { name: "Vazirmatn", data: fontData(black), weight: 900, style: "normal" },
  ]);
  return fontPromise;
}

function safeParam(searchParams: URLSearchParams, key: string, fallback = "") {
  return (searchParams.get(key) || fallback)
    .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = safeParam(searchParams, "kind", "organization") as keyof typeof kindLabels;
  const palette = kindColors[kind] || kindColors.organization;
  const locale = safeParam(searchParams, "locale", "fa").toLowerCase();
  const isRtl = locale === "fa" || locale === "ar";
  const label = (isRtl ? rtlKindLabels[kind] : kindLabels[kind]) || "Bazarbaaz";
  const title = safeParam(searchParams, "title", "Bazarbaaz");
  const subtitle = safeParam(searchParams, "subtitle", "Commerce and appointment booking");
  const organization = safeParam(searchParams, "organization", "bazar-baz.ir");
  const localeLabel = locale.toUpperCase();

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
          direction: isRtl ? "rtl" : "ltr",
          fontFamily: "Vazirmatn",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexDirection: isRtl ? "row-reverse" : "row", gap: 24 }}>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: isRtl ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: 62, fontWeight: 900, letterSpacing: 0 }}>Bazarbaaz</div>
            <div style={{ color: "#cbd5e1", fontSize: 28 }}>{organization}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: isRtl ? "flex-end" : "flex-start", gap: 18 }}>
          <div
            style={{
              alignSelf: isRtl ? "flex-end" : "flex-start",
              display: "flex",
              borderRadius: 999,
              background: palette.panel,
              color: palette.accent,
              fontSize: 26,
              fontWeight: 800,
              padding: "12px 22px",
            }}
          >
            {label} - {localeLabel}
          </div>
          <div style={{ maxWidth: 960, fontSize: 58, fontWeight: 900, lineHeight: 1.04, textAlign: isRtl ? "right" : "left" }}>
            {title}
          </div>
          <div style={{ maxWidth: 860, color: "#cbd5e1", fontSize: 30, lineHeight: 1.25, textAlign: isRtl ? "right" : "left" }}>
            {subtitle}
          </div>
          <div style={{ color: "#fde68a", fontSize: 30 }}>bazar-baz.ir</div>
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
