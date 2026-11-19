"use client";

import { Avatar } from "@/components/Avatar";
import { PlatformBadge } from "@/components/PlatformBadge";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { ConversationItem } from "@/lib/types";

export type InboxFilters = {
  platform: "" | PlatformKey;
  unreadOnly: boolean;
  assignee: "" | "me" | "none";
  q: string;
};

const UNSUPPORTED: Record<string, string> = {
  image: "ảnh",
  video: "video",
  audio: "ghi âm",
  sticker: "sticker",
  file: "tệp",
};

function preview(c: ConversationItem): string {
  const m = c.lastMessage;
  if (!m) return "";
  const prefix = m.direction === "outbound" ? "Bạn: " : "";
  if (m.kind === "text") return prefix + (m.body ?? "");
  if (m.kind === "image") return prefix + "[Ảnh]";
  return (
    prefix + `[${UNSUPPORTED[m.unsupportedType ?? ""] ?? m.unsupportedType ?? "nội dung khác"}]`
  );
}

function time(iso: string): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(
    "vi-VN",
    sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit" },
  );
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  filters,
  onFilters,
  platforms,
}: {
  items: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: InboxFilters;
  onFilters: (f: InboxFilters) => void;
  platforms: PlatformKey[];
}) {
  return (
    <section className="conv-list panel" aria-label="Danh sách cuộc trò chuyện">
      <div className="conv-filters">
        <input
          type="search"
          placeholder="Tìm tên khách"
          aria-label="Tìm tên khách"
          value={filters.q}
          onChange={(e) => onFilters({ ...filters, q: e.target.value })}
        />
        <div className="row">
          <select
            aria-label="Kênh"
            value={filters.platform}
            onChange={(e) =>
              onFilters({ ...filters, platform: e.target.value as InboxFilters["platform"] })
            }
          >
            <option value="">Mọi kênh</option>
            {platforms.map((p) => (
              <option key={p} value={p}>
                {PLATFORMS[p].label}
              </option>
            ))}
          </select>
          <select
            aria-label="Người phụ trách"
            value={filters.assignee}
            onChange={(e) =>
              onFilters({ ...filters, assignee: e.target.value as InboxFilters["assignee"] })
            }
          >
            <option value="">Mọi người</option>
            <option value="me">Của tôi</option>
            <option value="none">Chưa ai phụ trách</option>
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => onFilters({ ...filters, unreadOnly: e.target.checked })}
            />
            Chưa đọc
          </label>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="muted pad">Không có cuộc trò chuyện nào.</p>
      ) : (
        <ul className="conv-items">
          {items.map((c) => (
            <li
              key={c.id}
              className={`conv-item${c.id === selectedId ? " selected" : ""}${c.unread ? " unread" : ""}`}
              onClick={() => onSelect(c.id)}
              onKeyDown={(e) => e.key === "Enter" && onSelect(c.id)}
              tabIndex={0}
            >
              <Avatar name={c.customerName} url={c.avatarUrl} size={36} />
              <div className="conv-body">
                <div className="conv-top">
                  <PlatformBadge platform={c.platform} />
                  <strong className="conv-name">{c.customerName}</strong>
                  <span className="muted conv-time">{time(c.lastMessageAt)}</span>
                </div>
                <div className="conv-preview muted">{preview(c)}</div>
                {c.assignee && (
                  <div className="conv-assignee">
                    Phụ trách: {c.assignee.name ?? c.assignee.email}
                  </div>
                )}
              </div>
              {c.unread && <span className="unread-dot" aria-label="Chưa đọc" role="status" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
