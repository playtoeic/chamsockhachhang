import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, "src") };

export default defineConfig({
  resolve: { alias },
  test: {
    // Integration test dùng chung một cơ sở dữ liệu và xoá sạch trước mỗi test: chạy tuần tự
    // từng file (tuỳ chọn này chỉ đặt được ở cấp gốc).
    fileParallelism: false,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/contract/**/*.test.ts"],
          exclude: ["tests/unit/**/*.dom.test.ts"],
          setupFiles: ["tests/setup-env.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/unit/**/*.dom.test.ts"],
          setupFiles: ["tests/setup-env.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/global-setup.ts"],
          setupFiles: ["tests/setup-env.ts", "tests/setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
