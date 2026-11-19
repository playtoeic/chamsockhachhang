import { afterEach, describe, expect, it } from "vitest";
import { clock, setTestNow } from "@/lib/clock";

afterEach(() => setTestNow(null));

describe("clock", () => {
  it("trả thời điểm thật khi chưa đặt giờ test", () => {
    const before = Date.now();
    const now = clock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });

  it("trả đúng giờ đã đặt trong test và quay lại giờ thật khi bỏ đặt", () => {
    const fixed = new Date("2026-11-16T15:00:00Z");
    setTestNow(fixed);
    expect(clock.now().toISOString()).toBe(fixed.toISOString());
    setTestNow(null);
    expect(clock.now().getTime()).not.toBe(fixed.getTime());
  });

  it("trả bản sao để nơi gọi không sửa được giờ đã đặt", () => {
    setTestNow(new Date("2026-11-16T15:00:00Z"));
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
