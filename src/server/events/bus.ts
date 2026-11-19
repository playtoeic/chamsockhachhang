import { EventEmitter } from "node:events";

/** Các loại sự kiện thời gian thực (contracts/api.md, "Sự kiện thời gian thực"). */
export type EventType =
  | "conversation.updated"
  | "student.updated"
  | "student.deleted"
  | "trial-schedule.updated"
  | "class-schedule.updated"
  | "qa.updated"
  | "channel.updated"
  | "session.revoked";

export type AppEvent = {
  type: EventType;
  data: Record<string, unknown>;
  /** Chỉ gửi cho một người dùng (ví dụ session.revoked); trống = gửi cho mọi người. */
  toUserId?: string;
};

// Bộ phát nằm trong tiến trình: ứng dụng chạy đúng một bản (research.md R5).
const g = globalThis as unknown as { __eventBus?: EventEmitter };
const emitter = (g.__eventBus ??= new EventEmitter().setMaxListeners(0));

export function publish(
  type: EventType,
  data: Record<string, unknown>,
  opts: { toUserId?: string } = {},
): void {
  emitter.emit("event", { type, data, toUserId: opts.toUserId } satisfies AppEvent);
}

export function subscribe(listener: (e: AppEvent) => void): () => void {
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
