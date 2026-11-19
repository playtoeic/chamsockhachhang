import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startEveryMinute } from "@/server/schedule/scheduler";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("startEveryMinute", () => {
  it("gọi hàm mỗi 60 giây", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const stop = startEveryMinute(fn);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fn).toHaveBeenCalledTimes(3);
    stop();
  });

  it("một lần chạy lỗi (ném hoặc reject) thì các lần sau vẫn chạy", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("lỗi tạm"))
      .mockImplementationOnce(() => {
        throw new Error("lỗi đồng bộ");
      })
      .mockResolvedValue(undefined);
    const stop = startEveryMinute(fn);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(errors).toHaveBeenCalledTimes(2);
    stop();
    errors.mockRestore();
  });

  it("không chạy chồng khi lần trước chưa xong", async () => {
    let release = () => {};
    const fn = vi.fn(() => new Promise<void>((r) => (release = r)));
    const stop = startEveryMinute(fn);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(fn).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fn).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stop() dừng hẳn", async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const stop = startEveryMinute(fn);
    stop();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(fn).not.toHaveBeenCalled();
  });
});
