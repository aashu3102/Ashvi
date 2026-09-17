import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const apiUrl =
      process.env.ASHVI_API_URL ||
      process.env.NEXT_PUBLIC_ASHVI_API_URL ||
      "http://127.0.0.1:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
