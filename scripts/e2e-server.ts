// Máy chủ cho test end-to-end: cơ sở dữ liệu riêng + ứng dụng với kênh giả lập.
import { execSync, spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { E2E_ENV } from "../tests/e2e/env";
import { startLocalPg } from "./pg";

const port = process.argv[2] ?? "3100";

let stopPg: (() => Promise<void>) | undefined;
if (!process.env.E2E_DATABASE_URL) {
  const pg = await startLocalPg({ dir: ".pgdata-test", port: 54331, databases: ["inbox_e2e"] });
  stopPg = pg.stop;
}

const env = {
  ...process.env,
  ...E2E_ENV,
  UPLOAD_DIR: path.join(os.tmpdir(), "inbox-e2e-uploads"),
  APP_URL: `http://localhost:${port}`,
  AUTH_URL: `http://localhost:${port}`,
  NEXT_DIST_DIR: ".next-e2e",
};

// Mỗi test e2e tự xoá sạch dữ liệu (tests/e2e/helpers.ts → resetDb), nên chỉ cần migrate.
execSync("npx prisma migrate deploy", { env, stdio: "inherit" });

const child = spawn("npx", ["next", "dev", "--port", port], { env, stdio: "inherit", shell: true });

const shutdown = async () => {
  child.kill();
  await stopPg?.();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", async (code) => {
  await stopPg?.();
  process.exit(code ?? 0);
});
