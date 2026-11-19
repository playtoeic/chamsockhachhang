import { expect, test, type Browser } from "@playwright/test";
import {
  connectSimulator,
  customerSays,
  loginAs,
  OWNER,
  resetDb,
  seedStudent,
  STAFF,
} from "./helpers";

test.beforeEach(async () => {
  await resetDb();
});

async function twoBrowsers(browser: Browser) {
  const a = await browser.newContext();
  const b = await browser.newContext();
  await loginAs(a, OWNER);
  await loginAs(b, STAFF);
  return { a, b, pageA: await a.newPage(), pageB: await b.newPage() };
}

const FIVE_SECONDS = { timeout: 5000 };

test("thay đổi lịch học thử, lịch xếp học và tick bước ở trình duyệt A hiện ở B trong 5 giây (SC-006)", async ({
  browser,
}) => {
  const s = await seedStudent("Học sinh Realtime");
  const { a, b, pageA, pageB } = await twoBrowsers(browser);
  await pageA.goto("/steps"); // để trình duyệt A có phiên hoạt động

  // Lịch học thử: B đang mở tuần sau, A xếp buổi vào thứ 3 tuần sau.
  await pageB.goto("/trial-schedule");
  await pageB.getByRole("button", { name: "Tuần sau →" }).click();
  const header = await pageB.getByRole("columnheader", { name: /^Thứ 3 / }).textContent();
  const [dd, mm] = header!.replace("Thứ 3", "").trim().split("/");
  const year = new Date().getFullYear() + (Number(mm) < new Date().getMonth() + 1 ? 1 : 0);
  await pageA.request.put(`/api/students/${s.id}/trial`, {
    data: { date: `${year}-${mm}-${dd}`, slot: "S3" },
  });
  await expect(
    pageB
      .getByRole("cell", { name: /^Thứ 3 .*, 18–20$/ })
      .getByRole("button", { name: "Kéo Học sinh Realtime" }),
  ).toBeVisible(FIVE_SECONDS);

  // Lịch xếp học.
  await pageB.goto("/class-schedule");
  await expect(pageB.getByRole("table", { name: "Lưới lịch" })).toBeVisible();
  await pageA.request.put(`/api/students/${s.id}/class-slots/2/S4`);
  await expect(
    pageB
      .getByRole("cell", { name: "Thứ 3, 20–22" })
      .getByRole("button", { name: "Kéo Học sinh Realtime" }),
  ).toBeVisible(FIVE_SECONDS);

  // Tick bước.
  await pageB.goto("/steps");
  await pageB
    .getByRole("region", { name: "Danh sách học sinh" })
    .getByLabel(/^Học sinh Realtime,/)
    .click();
  const detail = pageB.getByRole("region", { name: "Chi tiết Học sinh Realtime" });
  await expect(detail.getByLabel("Đóng học phí")).not.toBeChecked();
  await pageA.request.put(`/api/students/${s.id}/steps/tuition_paid`, { data: { done: true } });
  await expect(detail.getByLabel("Đóng học phí")).toBeChecked(FIVE_SECONDS);

  await a.close();
  await b.close();
});

test("tin nhắn mới hiện ở trình duyệt khác; hai người cùng trả lời thì lịch sử ghi đúng tên từng người", async ({
  browser,
}) => {
  const { a, b, pageA, pageB } = await twoBrowsers(browser);
  await connectSimulator(pageA);
  await customerSays(pageA, "Khách Realtime", "Tin đầu tiên");

  await pageB.goto("/inbox");
  const listB = pageB.getByRole("region", { name: "Danh sách cuộc trò chuyện" });
  await listB.getByRole("listitem").filter({ hasText: "Khách Realtime" }).click();

  // Khách gửi tin mới: B thấy trong 5 giây mà không tải lại.
  await pageA.goto("/dev/simulator");
  await pageA.getByLabel("Tên khách").fill("Khách Realtime");
  await pageA.getByLabel("Nội dung").fill("Tin thứ hai");
  await pageA.getByRole("button", { name: "Gửi tin của khách" }).click();
  const threadB = pageB.getByRole("log", { name: "Lịch sử tin nhắn" });
  await expect(threadB.getByText("Tin thứ hai")).toBeVisible(FIVE_SECONDS);

  // Hai người cùng trả lời.
  await pageA.goto("/inbox");
  await pageA
    .getByRole("region", { name: "Danh sách cuộc trò chuyện" })
    .getByRole("listitem")
    .filter({ hasText: "Khách Realtime" })
    .click();
  await pageA.getByLabel("Nội dung trả lời").fill("Chủ trả lời");
  await pageB.getByLabel("Nội dung trả lời").fill("Nhân viên trả lời");
  await Promise.all([
    pageA.getByRole("button", { name: "Gửi", exact: true }).click(),
    pageB.getByRole("button", { name: "Gửi", exact: true }).click(),
  ]);
  for (const page of [pageA, pageB]) {
    const thread = page.getByRole("log", { name: "Lịch sử tin nhắn" });
    const fromOwner = thread.locator(".msg", { hasText: "Chủ trả lời" });
    const fromStaff = thread.locator(".msg", { hasText: "Nhân viên trả lời" });
    await expect(fromOwner.getByText(OWNER.name)).toBeVisible(FIVE_SECONDS);
    await expect(fromStaff.getByText(STAFF.name)).toBeVisible(FIVE_SECONDS);
  }

  await a.close();
  await b.close();
});
