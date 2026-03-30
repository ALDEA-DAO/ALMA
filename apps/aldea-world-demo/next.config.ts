import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@adasouls/soulbound-core",
    "@adasouls/soulbound-sdk",
    "@adasouls/soulbound-react",
  ],
};

export default nextConfig;
