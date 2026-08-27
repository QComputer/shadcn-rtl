import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

function resolveAppBasePath(): NextConfig["basePath"] {
  const raw = process.env.APP_BASE_PATH;
  if (!raw || raw.trim() === "") {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed === "/app") {
    return "/app";
  }

  throw new Error(
    `Unsupported APP_BASE_PATH: "${trimmed}". Only unset or "/app" are valid for Bazarbaaz builds.`
  );
}

const nextConfig: NextConfig = {
  basePath: resolveAppBasePath(),
  allowedDevOrigins: [
    "192.168.1.6",
    "*.localtest.me",
    process.env.NEXT_PUBLIC_APP_URL || "localhost:3000",
  ],
  logging: {
    incomingRequests: {
      ignore: [/^\/api\/integrations\/inoti\/ussd(?:\/|$)/],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
