import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',   // required for Docker / Cloud Run deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
