import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignore TypeScript errors during build
    ignoreBuildErrors: true,
  },
  eslint: {
    // Also disable ESLint during builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
