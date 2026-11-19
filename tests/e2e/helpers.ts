import { PrismaClient, type Role } from "@prisma/client";
import type { BrowserContext } from "@playwright/test";
import { createSession, SESSION_COOKIE } from "../helpers/session";
import { E2E_ENV } from "./env";

export const db = new PrismaClient({ datasources: { db: { url: E2E_ENV.DATABASE_URL } } });

/** Xoá sạch dữ liệu e2e giữa các test. */
export async function resetDb() {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Đăng nhập một trình duyệt bằng phiên tạo thẳng trong cơ sở dữ liệu. */
export async function loginAs(
  context: BrowserContext,
  opts: { email: string; role?: Role; name?: string },
) {
  const s = await createSession(db, opts);
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: s.sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return s.user;
}

export const OWNER = { email: E2E_ENV.OWNER_EMAIL, role: "owner" as const, name: "Chủ trung tâm" };
export const STAFF = { email: "nhanvien@gmail.com", role: "staff" as const, name: "Nhân viên Lan" };
