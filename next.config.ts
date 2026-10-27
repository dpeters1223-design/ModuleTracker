import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Google profile photos, used as chat avatars. Served as-is (they are already
  // 96px squares), so the optimizer is bypassed with `unoptimized` at the call site.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }],
  },
  // The walkthrough guide is a static page in public/guide (built by tools/walkthrough-guide).
  // The proxy runs before public files are served, so it stays behind sign-in.
  async rewrites() {
    return [{ source: "/guide", destination: "/guide/index.html" }];
  },
};

export default nextConfig;
