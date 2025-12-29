import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    browserDebugInfoInTerminal: true,
    serverActions: {
      allowedOrigins: [
        "lebjqylqv61w9ox1uiyp.apps.whop.com",
        "whop-ai-chat-kappa.vercel.app",
      ],
    },
  },
};

export default nextConfig;
