"use client";

import { useEffect, useRef } from "react";
import type { MessageItem } from "@/lib/types";

const TYPE_NAMES: Record<string, string> = {
  image: "ảnh",
  video: "video",
  audio: "ghi âm",
  sticker: "sticker",
  file: "tệp",
};

function senderLabel(m: MessageItem): string | null {
  if (m.direction === "inbound") return null;
  if (m.fromNativeApp) return "gửi từ ứng dụng gốc";
  return m.sentBy?.name ?? m.sentBy?.email ?? null;
}

export function MessageThread({
  messages,
  onRetry,
}: {
  messages: MessageItem[];
  onRetry: (id: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Chrome mới trả Promise từ scrollIntoView: không được trả nó ra khỏi effect.
    void end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <div className="thread" role="log" aria-label="Lịch sử tin nhắn">
      {messages.map((m) => (
        <div key={m.id} className={`msg ${m.direction}${m.status === "failed" ? " failed" : ""}`}>
          <div className="bubble">
            {m.kind === "text" && <span className="msg-text">{m.body}</span>}
            {m.kind === "image" && m.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="msg-image" src={m.mediaUrl} alt="Ảnh khách gửi" />
            )}
            {m.kind === "unsupported" && (
              <em className="muted">
                Khách gửi {TYPE_NAMES[m.unsupportedType ?? ""] ?? m.unsupportedType ?? "nội dung"} —
                mở ứng dụng gốc để xem.
              </em>
            )}
          </div>
          <div className="msg-meta muted">
            {senderLabel(m) && <span className="sender">{senderLabel(m)}</span>}
            <span>
              {new Date(m.createdAt).toLocaleString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
            {m.status === "sending" && <span>Đang gửi…</span>}
          </div>
          {m.status === "failed" && (
            <div className="msg-failed">
              <span className="error">Gửi thất bại: {m.failureReason}</span>
              <button type="button" onClick={() => onRetry(m.id)}>
                Gửi lại
              </button>
            </div>
          )}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
