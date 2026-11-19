import { describe, expect, it } from "vitest";
import { STATUSES, statusMeta } from "@/lib/status";
import { progress, STEPS } from "@/lib/steps";
import { initials } from "@/lib/initials";

describe("4 trạng thái (FR-013)", () => {
  it("đúng thứ tự, nhãn và màu", () => {
    expect(STATUSES.map((s) => [s.key, s.label, s.colorName])).toEqual([
      ["considering", "Đang tham khảo", "đỏ"],
      ["trialed", "Đã học thử", "xanh lá"],
      ["enrolled", "Đã đăng ký", "xanh dương"],
      ["dropped", "Ngừng theo", "xám"],
    ]);
    expect(statusMeta("trialed").color).toBe("var(--status-trialed)");
  });
});

describe("5 bước (FR-023, FR-024)", () => {
  it("đúng thứ tự và nhãn", () => {
    expect(STEPS.map((s) => [s.key, s.label])).toEqual([
      ["trial_scheduled", "Xếp lịch học thử"],
      ["class_scheduled", "Xếp lịch học thật"],
      ["entry_test", "Làm test đầu vào"],
      ["tuition_paid", "Đóng học phí"],
      ["commitment_signed", "Ký cam kết"],
    ]);
  });

  it("tiến độ = số bước đã xong trên 5, bỏ qua bước trùng hoặc chưa xong", () => {
    expect(progress([])).toEqual({ done: 0, total: 5 });
    expect(
      progress([
        { step: "entry_test", done: true },
        { step: "tuition_paid", done: false },
        { step: "trial_scheduled", done: true },
      ]),
    ).toEqual({ done: 2, total: 5 });
  });
});

describe("chữ cái đầu cho ô tên không có ảnh", () => {
  it("Nguyễn Văn An → NA", () => {
    expect(initials("Nguyễn Văn An")).toBe("NA");
  });
});
