import { PrismaClient, type Role } from "@prisma/client";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
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

/** Kéo thả bằng chuột theo từng bước (dnd-kit cần chuỗi sự kiện pointer có di chuyển). */
export async function drag(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Không tìm thấy vị trí kéo thả");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  // dnd-kit chặn cú bấm chuột ngay sau khi thả; chờ một nhịp như người dùng thật.
  await page.waitForTimeout(150);
}

/** Tạo học sinh thẳng trong cơ sở dữ liệu e2e. */
export async function seedStudent(
  name: string,
  data: { status?: "considering" | "trialed" | "enrolled" | "dropped"; source?: string } = {},
) {
  return db.student.create({
    data: { name, status: data.status ?? "considering", source: data.source ?? null },
  });
}
