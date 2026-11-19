import { expect, test } from "@playwright/test";
import { loginAs, OWNER, resetDb, STAFF } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("chưa đăng nhập mở /inbox thì bị chuyển về /login", async ({ page }) => {
  await page.goto("/inbox");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Đăng nhập bằng Google" })).toBeVisible();
});

test("chủ thấy 4 mục và mục Cài đặt", async ({ page, context }) => {
  await loginAs(context, OWNER);
  await page.goto("/inbox");
  const nav = page.getByRole("navigation", { name: "Mục chính" });
  for (const label of ["Tin nhắn", "Lịch: xếp lịch học", "Lịch: học thử", "Các bước", "Cài đặt"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
});

test("nhân viên thấy 4 mục, không thấy Cài đặt", async ({ page, context }) => {
  await loginAs(context, STAFF);
  await page.goto("/inbox");
  const nav = page.getByRole("navigation", { name: "Mục chính" });
  for (const label of ["Tin nhắn", "Lịch: xếp lịch học", "Lịch: học thử", "Các bước"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Cài đặt" })).toHaveCount(0);
});
