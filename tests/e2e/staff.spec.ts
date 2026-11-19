import { expect, test } from "@playwright/test";
import { loginAs, OWNER, resetDb, STAFF } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("chủ thêm nhân viên; nhân viên dùng 4 mục nhưng không vào được Cài đặt; gỡ thì bị đăng xuất trong 5 giây", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  await loginAs(ownerCtx, OWNER);

  await ownerPage.goto("/settings/staff");
  await ownerPage.getByLabel("Địa chỉ Gmail của nhân viên").fill(STAFF.email);
  await ownerPage.getByRole("button", { name: "Thêm nhân viên" }).click();
  await expect(ownerPage.getByRole("table", { name: "Danh sách người dùng" })).toContainText(STAFF.email);

  // Thêm trùng: báo lỗi.
  await ownerPage.getByLabel("Địa chỉ Gmail của nhân viên").fill(STAFF.email);
  await ownerPage.getByRole("button", { name: "Thêm nhân viên" }).click();
  await expect(ownerPage.getByText("Địa chỉ này đã có quyền truy cập")).toBeVisible();

  // Nhân viên đăng nhập (phiên tạo thẳng trong cơ sở dữ liệu thay cho Google).
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await loginAs(staffCtx, STAFF);
  await staffPage.goto("/inbox");
  const nav = staffPage.getByRole("navigation", { name: "Mục chính" });
  await expect(nav.getByRole("link", { name: "Tin nhắn" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Cài đặt" })).toHaveCount(0);

  for (const path of ["/settings/staff", "/settings/channels"]) {
    await staffPage.goto(path);
    await expect(staffPage).toHaveURL(/\/inbox$/);
  }

  // Chủ gỡ: trình duyệt của nhân viên về /login trong 5 giây.
  await ownerPage.reload();
  ownerPage.once("dialog", (d) => d.accept());
  await ownerPage.getByRole("button", { name: `Gỡ ${STAFF.email}` }).click();
  await expect(staffPage).toHaveURL(/\/login/, { timeout: 5000 });
  await expect(staffPage.getByText("Quyền truy cập của bạn đã bị gỡ.")).toBeVisible();

  await ownerCtx.close();
  await staffCtx.close();
});
