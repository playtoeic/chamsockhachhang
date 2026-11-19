import { expect, test } from "@playwright/test";
import { db, drag, loginAs, OWNER, resetDb, seedStudent } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("lịch xếp học: một học sinh ở nhiều khung, không nhân đôi, gỡ một khung, màu theo trạng thái, không có ngày tháng", async ({
  page,
  context,
}) => {
  const s = await seedStudent("Học sinh Xanh", { status: "trialed" });
  await loginAs(context, OWNER);
  await page.goto("/class-schedule");

  const grid = page.getByRole("table", { name: "Lưới lịch" });
  // Cột chỉ có thứ, không có ngày tháng.
  await expect(grid.getByRole("columnheader", { name: "Thứ 2", exact: true })).toBeVisible();
  await expect(grid.getByRole("columnheader", { name: /\d{2}\/\d{2}/ })).toHaveCount(0);

  const list = page.getByRole("complementary", { name: "Chưa có khung học" });
  const cell = (day: string, slot: string) => grid.getByRole("cell", { name: `${day}, ${slot}` });
  const chipIn = (c: ReturnType<typeof cell>) =>
    c.getByRole("button", { name: "Kéo Học sinh Xanh" });

  // Kéo vào 3 khung: từ danh sách, rồi từ khung này sang khung khác (thêm, không chuyển).
  await drag(page, list.getByRole("button", { name: "Kéo Học sinh Xanh" }), cell("Thứ 2", "18–20"));
  await expect(chipIn(cell("Thứ 2", "18–20"))).toBeVisible();
  await drag(page, chipIn(cell("Thứ 2", "18–20")), cell("Thứ 5", "18–20"));
  await expect(chipIn(cell("Thứ 5", "18–20"))).toBeVisible();
  await expect.poll(() => db.classAssignment.count({ where: { studentId: s.id } })).toBe(2);
  await drag(page, chipIn(cell("Thứ 2", "18–20")), cell("Thứ 7", "9–11"));
  for (const [d, sl] of [
    ["Thứ 2", "18–20"],
    ["Thứ 5", "18–20"],
    ["Thứ 7", "9–11"],
  ])
    await expect(chipIn(cell(d, sl))).toBeVisible();
  await expect.poll(() => db.classAssignment.count({ where: { studentId: s.id } })).toBe(3);
  await expect
    .poll(() =>
      db.stepProgress.count({ where: { studentId: s.id, step: "class_scheduled", done: true } }),
    )
    .toBe(1);

  // Thả lại vào khung đã có: không nhân đôi.
  await drag(page, chipIn(cell("Thứ 2", "18–20")), cell("Thứ 5", "18–20"));
  await expect(chipIn(cell("Thứ 5", "18–20"))).toHaveCount(1);
  await expect.poll(() => db.classAssignment.count({ where: { studentId: s.id } })).toBe(3);

  // Màu ô tên đúng trạng thái "đã học thử".
  await expect(cell("Thứ 5", "18–20").getByLabel("Học sinh Xanh, Đã học thử")).toBeVisible();

  // Gỡ một khung bằng nút ×: hai khung còn lại giữ nguyên.
  await page.getByRole("button", { name: "Gỡ Học sinh Xanh khỏi Thứ 5 18–20" }).click();
  await expect(chipIn(cell("Thứ 5", "18–20"))).toHaveCount(0);
  await expect(chipIn(cell("Thứ 2", "18–20"))).toBeVisible();
  await expect(chipIn(cell("Thứ 7", "9–11"))).toBeVisible();
  await expect.poll(() => db.classAssignment.count({ where: { studentId: s.id } })).toBe(2);
});
