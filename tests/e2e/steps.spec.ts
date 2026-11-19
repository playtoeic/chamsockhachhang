import { expect, test } from "@playwright/test";
import { connectSimulator, customerSays, loginAs, OWNER, resetDb, STAFF } from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

test("khách tự có hồ sơ; tạo hồ sơ thủ công; tick bước; đổi trạng thái; người khác thấy cùng tiến độ", async ({
  page,
  context,
  browser,
}) => {
  await loginAs(context, OWNER);
  await connectSimulator(page);
  await customerSays(page, "Khách A", "Cho em hỏi học phí");

  await page.goto("/steps");
  const list = page.getByRole("region", { name: "Danh sách học sinh" });
  const chipA = list.getByLabel("Khách A, Đang tham khảo");
  await expect(chipA).toBeVisible();
  await expect(chipA).toContainText("Giả lập");
  await expect(chipA.getByRole("img", { name: "Ảnh đại diện Khách A" })).toBeVisible();
  await expect(list.getByRole("img", { name: "Tiến độ 0/5" })).toBeVisible();

  // Bảng chú thích đủ 4 màu.
  const legend = page.getByRole("list", { name: "Chú thích màu" });
  for (const label of ["Đang tham khảo", "Đã học thử", "Đã đăng ký", "Ngừng theo"]) {
    await expect(legend.getByText(label)).toBeVisible();
  }

  // Hồ sơ thủ công cho khách từ Threads: chữ cái đầu và dòng nguồn.
  await page.getByRole("button", { name: "+ Thêm học sinh" }).click();
  await page.getByLabel("Tên học sinh mới").fill("Khách B");
  await page.getByLabel("Nguồn", { exact: true }).fill("Threads");
  await page.getByRole("button", { name: "Tạo hồ sơ" }).click();
  const chipB = list.getByLabel("Khách B, Đang tham khảo");
  await expect(chipB).toContainText("Threads");
  await expect(chipB.getByLabel("Chữ cái đầu của Khách B")).toHaveText("KB");

  // Tick một bước và đổi trạng thái.
  await chipA.click();
  const detail = page.getByRole("region", { name: "Chi tiết Khách A" });
  await detail.getByLabel("Làm test đầu vào").check();
  await expect(detail.getByRole("img", { name: "Tiến độ 1/5" })).toBeVisible();
  await detail.getByLabel("Trạng thái").selectOption("enrolled");
  await expect(list.getByLabel("Khách A, Đã đăng ký")).toBeVisible();

  // Nhân viên ở trình duyệt khác thấy cùng tiến độ.
  const other = await browser.newContext();
  const staffPage = await other.newPage();
  await loginAs(other, STAFF);
  await staffPage.goto("/steps");
  await staffPage.getByRole("region", { name: "Danh sách học sinh" }).getByLabel("Khách A, Đã đăng ký").click();
  const staffDetail = staffPage.getByRole("region", { name: "Chi tiết Khách A" });
  await expect(staffDetail.getByRole("img", { name: "Tiến độ 1/5" })).toBeVisible();
  await expect(staffDetail.getByLabel("Làm test đầu vào")).toBeChecked();
  await other.close();
});
