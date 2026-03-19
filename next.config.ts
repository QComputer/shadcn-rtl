import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["192.168.1.6", process.env.NEXT_PUBLIC_APP_URL||"localhost:3000"],
};

export default nextConfig;
