import { expect, test } from "@playwright/test";
import { connectSimulator, customerSays, loginAs, OWNER, resetDb } from "./helpers";

const convs = () =>
  pageRef.getByRole("region", { name: "Danh sách cuộc trò chuyện" }).getByRole("listitem");
let pageRef: import("@playwright/test").Page;

test.beforeEach(async () => {
  await resetDb();
});

test("hộp thư chung: nhận, trả lời, gửi thất bại, gửi lại, trả lời từ ứng dụng gốc, bộ lọc của tôi", async ({
  page,
  context,
}) => {
  pageRef = page;
  await loginAs(context, OWNER);
  await connectSimulator(page);
  await customerSays(page, "Khách A", "Cho em hỏi lịch học");

  // Tin đến hiện trên cùng, chưa đọc, có ảnh đại diện.
  await page.goto("/inbox");
  const first = convs().first();
  await expect(first).toContainText("Khách A");
  await expect(first.getByLabel("Chưa đọc")).toBeVisible();
  await expect(first.getByRole("img", { name: "Ảnh đại diện Khách A" })).toBeVisible();

  // Trả lời: hiện ở hộp thư đi của kênh giả lập và trong lịch sử kèm tên người gửi.
  await first.click();
  await expect(page.getByText("Cho em hỏi lịch học")).toBeVisible();
  await page.getByLabel("Nội dung trả lời").fill("Chào bạn, lịch học tối thứ 3");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  const thread = page.getByRole("log", { name: "Lịch sử tin nhắn" });
  await expect(thread.getByText("Chào bạn, lịch học tối thứ 3")).toHaveCount(1);
  await expect(thread.getByText("Chủ trung tâm").first()).toBeVisible();

  await page.goto("/dev/simulator");
  await expect(page.getByRole("table", { name: "Hộp thư đi" })).toContainText(
    "Chào bạn, lịch học tối thứ 3",
  );

  // Bật "từ chối tin gửi": tin hiện "gửi thất bại" kèm lý do và gửi lại được.
  await page.getByLabel("Từ chối tin gửi").selectOption("rejected");
  await expect(page.getByText("Đã lưu cài đặt giả lập")).toBeVisible();
  await page.goto("/inbox");
  await convs().first().click();
  await page.getByLabel("Nội dung trả lời").fill("Tin này sẽ lỗi");
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await expect(thread.getByText("Gửi thất bại: Kênh từ chối tin nhắn này")).toBeVisible();

  await page.goto("/dev/simulator");
  await page.getByLabel("Từ chối tin gửi").selectOption("");
  await expect(page.getByText("Đã lưu cài đặt giả lập")).toBeVisible();
  await page.goto("/inbox");
  await convs().first().click();
  await thread.getByRole("button", { name: "Gửi lại" }).click();
  await expect(thread.getByText("Gửi thất bại")).toHaveCount(0);

  // Câu trả lời gõ trong ứng dụng gốc hiện đúng một lần, kèm nhãn.
  await page.goto("/dev/simulator");
  await page.getByLabel("Tên khách").fill("Khách A");
  await page.getByLabel("Nội dung").fill("Trả lời trong ứng dụng");
  await page.getByRole("button", { name: "Gửi câu trả lời từ ứng dụng gốc" }).click();
  await expect(page.getByText("Đã gửi câu trả lời từ ứng dụng gốc")).toBeVisible();
  await page.goto("/inbox");
  await convs().first().click();
  await expect(thread.getByText("Trả lời trong ứng dụng")).toHaveCount(1);
  await expect(thread.getByText("gửi từ ứng dụng gốc")).toHaveCount(1);
  await expect(thread.getByText("Chào bạn, lịch học tối thứ 3")).toHaveCount(1);

  // Bộ lọc "của tôi".
  await customerSays(page, "Khách B", "Xin giá học phí");
  await page.goto("/inbox");
  await convs().filter({ hasText: "Khách A" }).click();
  await page.getByRole("button", { name: "Nhận" }).click();
  await expect(
    page
      .getByRole("region", { name: "Cuộc trò chuyện", exact: true })
      .getByText("Phụ trách: Chủ trung tâm"),
  ).toBeVisible();
  await page.getByLabel("Người phụ trách").selectOption("me");
  await expect(convs()).toHaveCount(1);
  await expect(convs().first()).toContainText("Khách A");
});
