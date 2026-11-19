"use client";

import { useState } from "react";
import { useCurrentUser } from "@/components/UserContext";
import type { ActiveUser, ConversationItem } from "@/lib/types";

function windowText(expires: string | null): { text: string; expired: boolean } | null {
  if (!expires) return null;
  const ms = new Date(expires).getTime() - Date.now();
  if (ms <= 0) return { text: "Đã quá thời hạn trả lời trên kênh này", expired: true };
  const h = Math.floor(ms / 3600_000);
  const m = Math.floor((ms % 3600_000) / 60_000);
  return { text: `Còn ${h > 0 ? `${h} giờ ` : ""}${m} phút để trả lời`, expired: false };
}

export function ReplyBox({
  conversation,
  users,
  onSend,
  onAssign,
}: {
  conversation: ConversationItem;
  users: ActiveUser[];
  onSend: (text: string) => Promise<void>;
  onAssign: (userId: string | null) => Promise<void>;
}) {
  const me = useCurrentUser();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const win = windowText(conversation.replyWindowExpiresAt);
  const assignee = conversation.assignee;

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onSend(text);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reply">
      <div className="reply-bar">
        <span>
          {assignee ? `Phụ trách: ${assignee.name ?? assignee.email}` : "Chưa ai phụ trách"}
        </span>
        {me.role === "owner" ? (
          <select
            aria-label="Giao cho"
            value={assignee?.id ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
          >
            <option value="">— Không ai —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        ) : null}
        {!assignee && (
          <button type="button" onClick={() => onAssign(me.id)}>
            Nhận
          </button>
        )}
        {assignee?.id === me.id && (
          <button type="button" onClick={() => onAssign(null)}>
            Bỏ nhận
          </button>
        )}
        <span className="spacer" />
        {win && <span className={win.expired ? "error" : "muted"}>{win.text}</span>}
      </div>
      <div className="reply-input">
        <textarea
          aria-label="Nội dung trả lời"
          placeholder="Nhập câu trả lời… (Ctrl+Enter để gửi)"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit();
          }}
        />
        <button className="primary" type="button" onClick={submit} disabled={busy || !text.trim()}>
          Gửi
        </button>
      </div>
    </div>
  );
}
