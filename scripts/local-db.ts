// Chạy PostgreSQL nhúng cho phát triển cục bộ: `npm run db:local`. Ctrl+C để dừng.
import { startLocalPg } from "./pg";

const pg = await startLocalPg({ dir: ".pgdata", port: 54329, databases: ["inbox", "inbox_test"] });
console.log(`PostgreSQL đang chạy: ${pg.url("inbox")}`);

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
setInterval(() => {}, 1 << 30);
