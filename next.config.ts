import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Test e2e dùng thư mục build riêng để không đụng máy chủ dev đang chạy.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Ứng dụng chạy thành một tiến trình Node thường trực (research.md R2, R5).
  serverExternalPackages: ["@prisma/client", "embedded-postgres"],
  agentRules: false,
};

export default nextConfig;
