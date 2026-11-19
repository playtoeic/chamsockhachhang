import { expect, test } from "@playwright/test";
import { loginAs, OWNER, resetDb, STAFF } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("chủ thêm hỏi–đáp; nhân viên tìm bằng từ khoá, sao chép được, không thấy nút sửa/xoá", async ({
  browser,
}) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await loginAs(ownerCtx, OWNER);
  await owner.goto("/steps");
  const qa = owner.getByRole("region", { name: "Hỏi – đáp" });
  await qa.getByRole("button", { name: "+ Thêm câu hỏi" }).click();
  await qa.getByLabel("Câu hỏi").fill("Học phí bao nhiêu?");
  await qa.getByLabel("Câu trả lời mẫu").fill("Học phí là 2 triệu mỗi tháng, đóng theo khoá.");
  await qa.getByRole("button", { name: "Lưu" }).click();
  await expect(qa.getByRole("listitem", { name: "Học phí bao nhiêu?" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "Sửa" })).toBeVisible();

  const staffCtx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const staff = await staffCtx.newPage();
  await loginAs(staffCtx, STAFF);
  await staff.goto("/steps");
  const sqa = staff.getByRole("region", { name: "Hỏi – đáp" });
  await sqa.getByLabel("Tìm hỏi đáp").fill("học phí");
  const item = sqa.getByRole("listitem", { name: "Học phí bao nhiêu?" });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Sao chép câu trả lời" }).click();
  await expect(item.getByRole("button", { name: "Đã sao chép" })).toBeVisible();
  expect(await staff.evaluate(() => navigator.clipboard.readText())).toBe(
    "Học phí là 2 triệu mỗi tháng, đóng theo khoá.",
  );
  await expect(sqa.getByRole("button", { name: "Sửa" })).toHaveCount(0);
  await expect(sqa.getByRole("button", { name: "Xoá" })).toHaveCount(0);
  await expect(sqa.getByRole("button", { name: "+ Thêm câu hỏi" })).toHaveCount(0);

  // Không tìm thấy với từ khoá không liên quan.
  await sqa.getByLabel("Tìm hỏi đáp").fill("bơi lội");
  await expect(sqa.getByText("Chưa có câu hỏi nào.")).toBeVisible();

  await ownerCtx.close();
  await staffCtx.close();
});
