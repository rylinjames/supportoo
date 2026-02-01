import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    browserDebugInfoInTerminal: true,
    serverActions: {
      allowedOrigins: [
        "lebjqylqv61w9ox1uiyp.apps.whop.com",
        "supportoo.vercel.app",
        "https://supportoo.vercel.app",
        "*.whop.com",
        "*.apps.whop.com",
      ],
    },
  },
};

export default nextConfig;
