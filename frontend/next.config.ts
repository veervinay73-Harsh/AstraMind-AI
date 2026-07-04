import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: ["*.ngrok-free.dev", "localhost:3000", "localhost:3001"]
  }
};

export default nextConfig;
