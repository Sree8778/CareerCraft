import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',   // required for Docker / Cloud Run deployment
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
