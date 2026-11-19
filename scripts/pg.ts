import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

export type LocalPg = { url: (db: string) => string; stop: () => Promise<void> };

/**
 * Khởi động một PostgreSQL thật (bản nhúng từ npm) cho máy không có Docker.
 * Dữ liệu nằm trong `dir`; tạo các cơ sở dữ liệu trong `databases` nếu chưa có.
 */
export async function startLocalPg(opts: {
  dir: string;
  port: number;
  databases: string[];
}): Promise<LocalPg> {
  const databaseDir = path.resolve(opts.dir);
  const pg = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: opts.port,
    persistent: true,
    // Bắt buộc UTF-8: trên Windows, initdb mặc định theo bảng mã hệ thống (WIN1252) và không
    // lưu được tiếng Việt.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  for (const db of opts.databases) {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [db]);
    if (res.rowCount === 0) await client.query(`CREATE DATABASE "${db}"`);
  }
  await client.end();
  return {
    url: (db) => `postgresql://postgres:postgres@localhost:${opts.port}/${db}`,
    stop: () => pg.stop(),
  };
}
