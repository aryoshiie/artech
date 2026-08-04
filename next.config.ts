import type { NextConfig } from "next";

const AGENT_CORE_URL =
  process.env.AGENT_CORE_URL || "http://localhost:3030";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Proxy all /agent-core/* paths to the agent-core mini-service on port 3030.
  // This lets both client and server code use relative paths only —
  // no `http://localhost:3030` URLs anywhere in the codebase.
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
