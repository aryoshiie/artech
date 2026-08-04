import type { NextConfig } from "next";

const AGENT_CORE_URL = process.env.AGENT_CORE_URL || "http://localhost:3030";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/agent-core/:path*",
        destination: `${AGENT_CORE_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
