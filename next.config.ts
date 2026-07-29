import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets Header read the office-selection cookie (see src/lib/preferences.ts) as a small
  // Suspense-streamed dynamic island, while the rest of the (public) route tree stays a
  // static-generated shell. See docs/decisions/0005-cache-components.md.
  cacheComponents: true,
};

export default nextConfig;
