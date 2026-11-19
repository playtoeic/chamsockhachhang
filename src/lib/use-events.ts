"use client";

import { useEffect, useRef } from "react";

export type ClientEventType =
  | "conversation.updated"
  | "student.updated"
  | "student.deleted"
  | "trial-schedule.updated"
  | "class-schedule.updated"
  | "qa.updated"
  | "channel.updated"
  | "session.revoked";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventHandlers = Partial<Record<ClientEventType, (data: any) => void>>;

const ALL_TYPES: ClientEventType[] = [
  "conversation.updated",
  "student.updated",
  "student.deleted",
  "trial-schedule.updated",
  "class-schedule.updated",
  "qa.updated",
  "channel.updated",
  "session.revoked",
];

const RECONNECT_MS = 3000;

/**
 * Mở luồng /api/events, gọi callback theo loại sự kiện, tự kết nối lại khi mất kết nối và gọi
 * `onReconnect` để trang tải lại dữ liệu đã lỡ. Trả hàm đóng kết nối.
 */
export function connectEvents(
  handlers: EventHandlers | (() => EventHandlers),
  opts: { onReconnect?: () => void } = {},
  ES: typeof EventSource = EventSource,
): () => void {
  const get = typeof handlers === "function" ? handlers : () => handlers;
  let es: EventSource | null = null;
  let closed = false;
  let hadConnection = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    if (closed) return;
    es = new ES("/api/events");
    es.onopen = () => {
      if (hadConnection) opts.onReconnect?.();
      hadConnection = true;
    };
    es.onerror = () => {
      if (closed || !es || es.readyState !== 2) return;
      es.close();
      timer = setTimeout(open, RECONNECT_MS);
    };
    for (const type of ALL_TYPES) {
      es.addEventListener(type, (e) => {
        const fn = get()[type];
        if (!fn) return;
        let data: unknown = {};
        try {
          data = JSON.parse((e as MessageEvent).data);
        } catch {}
        fn(data);
      });
    }
  };

  open();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
  };
}

/** Hook React: đăng ký callback sự kiện thời gian thực cho một trang. */
export function useEvents(handlers: EventHandlers, onReconnect?: () => void): void {
  const ref = useRef({ handlers, onReconnect });
  useEffect(() => {
    ref.current = { handlers, onReconnect };
  });
  useEffect(
    () =>
      connectEvents(() => ref.current.handlers, {
        onReconnect: () => ref.current.onReconnect?.(),
      }),
    [],
  );
}
