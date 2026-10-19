import type { NextConfig } from "next";
import { resolveAppBasePath } from "./lib/app-base-path";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const appBasePath = resolveAppBasePath();
// Next expects hostname patterns here, not a full URL (scheme or port).
function configuredDevelopmentHost() {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").hostname; }
  catch { return "localhost"; }
}

const nextConfig: NextConfig = {
  basePath: appBasePath || undefined,
  env: { NEXT_PUBLIC_APP_BASE_PATH: appBasePath },
  allowedDevOrigins: [
    "192.168.1.6",
    "*.localtest.me",
    configuredDevelopmentHost(),
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

if (process.env.BAZARBAAZ_BUILD_CACHE === "off") {
  nextConfig.webpack = (config, { dev }) => {
    if (!dev) {
      config.cache = false;
    }
    return config;
  };
}

export default nextConfig;
