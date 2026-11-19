import { PrismaClient, type Role } from "@prisma/client";
import { expect, type BrowserContext, type Page } from "@playwright/test";
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

/** Kết nối kênh giả lập ở trang Kênh (cần tài khoản chủ). */
export async function connectSimulator(page: Page) {
  await page.goto("/settings/channels");
  await page.getByRole("button", { name: "Kết nối Giả lập" }).click();
  await expect(page.getByText("Trang giả lập")).toBeVisible();
  await expect(page.getByText("Đang kết nối")).toBeVisible();
}

/** Một khách gửi tin qua kênh giả lập. */
export async function customerSays(page: Page, name: string, text: string) {
  await page.goto("/dev/simulator");
  await page.getByLabel("Tên khách").fill(name);
  await page.getByLabel("Nội dung").fill(text);
  await page.getByRole("button", { name: "Gửi tin của khách" }).click();
  await expect(page.getByText("Đã gửi tin của khách")).toBeVisible();
}
