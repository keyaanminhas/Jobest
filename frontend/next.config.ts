import type { NextConfig } from "next";

const backendOrigin = process.env.BACKEND_INTERNAL_ORIGIN ?? "http://127.0.0.1:8000";
const allowedDevOrigins = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "https://hornet-wealthy-violently.ngrok-free.app",
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendOrigin}/health`,
      },
    ];
  },
};

export default nextConfig;
