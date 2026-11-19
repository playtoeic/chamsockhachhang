import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { startLocalPg, type LocalPg } from "../scripts/pg";

let pg: LocalPg | undefined;

/** Chuẩn bị cơ sở dữ liệu test: dùng TEST_DATABASE_URL nếu có, nếu không thì chạy PostgreSQL nhúng. */
export default async function setup(project: TestProject) {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    pg = await startLocalPg({ dir: ".pgdata-test", port: 54330, databases: ["inbox_test"] });
    url = pg.url("inbox_test");
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
  project.provide("databaseUrl", url);
  return async () => {
    await pg?.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
