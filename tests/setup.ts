import { afterAll, beforeEach, inject } from "vitest";

process.env.DATABASE_URL = inject("databaseUrl");

const { prisma } = await import("@/server/db");

/** Xoá sạch mọi bảng (trừ bảng migration) trước mỗi test. */
beforeEach(async () => {
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
});

afterAll(async () => {
  await prisma.$disconnect();
});
