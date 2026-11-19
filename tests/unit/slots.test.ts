import { describe, expect, it } from "vitest";
import {
  addDays,
  isTrialDate,
  SLOTS,
  slotEnd,
  vnToday,
  WEEKDAYS,
  weekdayOf,
  weekDates,
  weekStart,
} from "@/lib/slots";

describe("khung giờ và ngày (FR-016)", () => {
  it("4 khung S1 09–11, S2 14–16, S3 18–20, S4 20–22", () => {
    expect(SLOTS.map((s) => [s.key, s.start, s.end, s.label])).toEqual([
      ["S1", 9, 11, "9–11"],
      ["S2", 14, 16, "14–16"],
      ["S3", 18, 20, "18–20"],
      ["S4", 20, 22, "20–22"],
    ]);
  });

  it("6 ngày thứ 2–thứ 7, không có Chủ nhật", () => {
    expect(WEEKDAYS.map((d) => [d.key, d.label])).toEqual([
      [1, "Thứ 2"],
      [2, "Thứ 3"],
      [3, "Thứ 4"],
      [4, "Thứ 5"],
      [5, "Thứ 6"],
      [6, "Thứ 7"],
    ]);
  });
});

describe("tuần và ngày theo giờ Việt Nam", () => {
  it("weekStart trả thứ 2 của tuần; Chủ nhật thuộc tuần bắt đầu từ thứ 2 trước đó", () => {
    expect(weekStart("2026-11-16")).toBe("2026-11-16"); // thứ 2
    expect(weekStart("2026-11-21")).toBe("2026-11-16"); // thứ 7
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Chủ nhật
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });

  it("weekDates trả 6 ngày thứ 2–thứ 7; addDays qua tháng", () => {
    expect(weekDates("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
    ]);
    expect(addDays("2026-11-16", -7)).toBe("2026-11-09");
  });

  it("vnToday dùng giờ Việt Nam: 18:00 UTC ngày 16 là ngày 17 ở Việt Nam", () => {
    expect(vnToday(new Date("2026-11-16T16:59:00Z"))).toBe("2026-11-16");
    expect(vnToday(new Date("2026-11-16T18:00:00Z"))).toBe("2026-11-17");
  });

  it("slotEnd trả đúng thời điểm UTC: S4 kết thúc 22:00 giờ Việt Nam = 15:00 UTC", () => {
    expect(slotEnd("2026-11-17", "S4").toISOString()).toBe("2026-11-17T15:00:00.000Z");
    expect(slotEnd("2026-11-17", "S1").toISOString()).toBe("2026-11-17T04:00:00.000Z");
  });

  it("Chủ nhật và ngày sai định dạng bị từ chối", () => {
    expect(weekdayOf("2026-11-22")).toBe(7);
    expect(isTrialDate("2026-11-22")).toBe(false);
    expect(isTrialDate("2026-11-21")).toBe(true);
    expect(isTrialDate("2026-02-30")).toBe(false);
    expect(isTrialDate("17/11/2026")).toBe(false);
  });
});
