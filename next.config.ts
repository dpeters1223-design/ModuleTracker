import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The walkthrough guide is a static page in public/guide (built by tools/walkthrough-guide).
  // The proxy runs before public files are served, so it stays behind sign-in.
  async rewrites() {
    return [{ source: "/guide", destination: "/guide/index.html" }];
  },
};

export default nextConfig;
