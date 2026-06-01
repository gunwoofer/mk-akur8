import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // framer-motion v12 ships optional chaining and nullish coalescing in its
  // CJS bundle which Safari 12 (iOS 12) cannot parse. Transpiling it through
  // Next.js's SWC pipeline (which already targets iOS 12) fixes the crash.
  // @dnd-kit and @supabase already publish ES5-compatible CJS — no need.
  transpilePackages: ["framer-motion"],
};

export default nextConfig;
