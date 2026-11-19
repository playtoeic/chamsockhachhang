import { expect, test } from "@playwright/test";
import { db, drag, loginAs, OWNER, resetDb, seedStudent } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("lịch học thử: lưới có ngày tháng, kéo thả, chuyển tuần, gỡ, tự tick, khung đã qua chuyển xanh lá ngay", async ({
  page,
  context,
}) => {
  const red = await seedStudent("Học sinh Đỏ");
  await seedStudent("Người khác");
  await loginAs(context, OWNER);
  await page.goto("/trial-schedule");

  // Lưới 6 cột có ngày tháng và 4 hàng khung giờ, không có Chủ nhật.
  const grid = page.getByRole("table", { name: "Lưới lịch" });
  await expect(grid.getByRole("columnheader")).toHaveCount(7);
  for (const d of ["Thứ 2", "Thứ 7"])
    await expect(
      grid.getByRole("columnheader", { name: new RegExp(`^${d} \\d{2}/\\d{2}$`) }),
    ).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: /Chủ nhật/ })).toHaveCount(0);
  for (const s of ["9–11", "14–16", "18–20", "20–22"])
    await expect(grid.getByRole("rowheader", { name: s })).toBeVisible();

  // Danh sách chưa xếp tìm được theo tên.
  const list = page.getByRole("complementary", { name: "Chưa xếp" });
  await list.getByLabel("Tìm học sinh chưa xếp").fill("đỏ");
  await expect(list.getByRole("button", { name: /^Kéo / })).toHaveCount(1);
  await list.getByLabel("Tìm học sinh chưa xếp").fill("");
  await expect(list.getByRole("button", { name: /^Kéo / })).toHaveCount(2);

  const cell = (re: RegExp) => grid.getByRole("cell", { name: re });
  const chip = (scope: ReturnType<typeof cell>) =>
    scope.getByRole("button", { name: "Kéo Học sinh Đỏ" });

  // Tuần sau: kéo vào thứ 4 18–20, bước "xếp lịch học thử" tự tick.
  await page.getByRole("button", { name: "Tuần sau →" }).click();
  const wed = cell(/^Thứ 4 .*, 18–20$/);
  await drag(page, list.getByRole("button", { name: "Kéo Học sinh Đỏ" }), wed);
  await expect(chip(wed)).toBeVisible();
  await expect
    .poll(() =>
      db.stepProgress.count({ where: { studentId: red.id, step: "trial_scheduled", done: true } }),
    )
    .toBe(1);

  // Kéo sang khung khác: chỉ còn ở khung mới.
  const fri = cell(/^Thứ 6 .*, 9–11$/);
  await drag(page, chip(wed), fri);
  await expect(chip(fri)).toBeVisible();
  await expect(chip(wed)).toHaveCount(0);

  // Chuyển sang tuần sau nữa và kéo học sinh vào: biến mất khỏi tuần trước.
  await page.getByRole("button", { name: "Tuần sau →" }).click();
  await page.getByText("Đã có lịch tuần khác").click();
  const mon = cell(/^Thứ 2 .*, 14–16$/);
  await drag(page, list.getByRole("button", { name: "Kéo Học sinh Đỏ" }), mon);
  await expect(chip(mon)).toBeVisible();
  await page.getByRole("button", { name: "← Tuần trước" }).click();
  await expect(grid.getByRole("button", { name: "Kéo Học sinh Đỏ" })).toHaveCount(0);
  await expect.poll(() => db.trialBooking.count()).toBe(1);

  // Kéo về danh sách chưa xếp thì gỡ buổi.
  await page.getByRole("button", { name: "Tuần sau →" }).click();
  await drag(page, chip(mon), list);
  await expect(list.getByRole("button", { name: "Kéo Học sinh Đỏ" })).toBeVisible();
  await expect.poll(() => db.trialBooking.count()).toBe(0);

  // Khung đã qua (ghi bù): ô tên chuyển xanh lá ngay khi thả.
  await page.getByRole("button", { name: "Tuần này" }).click();
  await page.getByRole("button", { name: "← Tuần trước" }).click();
  const past = cell(/^Thứ 2 .*, 9–11$/);
  await drag(page, list.getByRole("button", { name: "Kéo Học sinh Đỏ" }), past);
  await expect(past.getByLabel("Học sinh Đỏ, Đã học thử")).toBeVisible();
});
