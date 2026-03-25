import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "recharts",
      "framer-motion",
      "@tiptap/react",
      "@tiptap/starter-kit",
      "googleapis",
      "emoji-mart",
    ],
  },
};

export default nextConfig;
