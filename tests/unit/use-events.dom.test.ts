import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectEvents } from "@/lib/use-events";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CLOSED = 2;
  readyState = 0;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  emit(type: string, data: unknown) {
    for (const fn of this.listeners[type] ?? [])
      fn(new MessageEvent(type, { data: JSON.stringify(data) }));
  }
  fail() {
    this.readyState = 2;
    this.onerror?.();
  }
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const make = () => FakeEventSource as unknown as typeof EventSource;

describe("connectEvents", () => {
  it("mở /api/events và gọi đúng callback theo loại sự kiện", () => {
    const onStudent = vi.fn();
    const onQa = vi.fn();
    connectEvents({ "student.updated": onStudent, "qa.updated": onQa }, {}, make());
    const es = FakeEventSource.instances[0];
    expect(es.url).toBe("/api/events");
    es.open();
    es.emit("student.updated", { studentId: "s1" });
    expect(onStudent).toHaveBeenCalledWith({ studentId: "s1" });
    expect(onQa).not.toHaveBeenCalled();
  });

  it("mất kết nối thì tự kết nối lại và gọi hàm tải lại sau khi kết nối lại", () => {
    const onReconnect = vi.fn();
    connectEvents({}, { onReconnect }, make());
    FakeEventSource.instances[0].open();
    expect(onReconnect).not.toHaveBeenCalled();
    FakeEventSource.instances[0].fail();
    vi.advanceTimersByTime(5000);
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[1].open();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("đóng kết nối thì không kết nối lại nữa", () => {
    const close = connectEvents({}, {}, make());
    FakeEventSource.instances[0].open();
    close();
    expect(FakeEventSource.instances[0].closed).toBe(true);
    FakeEventSource.instances[0].fail();
    vi.advanceTimersByTime(10_000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });
});
