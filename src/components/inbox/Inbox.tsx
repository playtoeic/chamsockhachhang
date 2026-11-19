"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useEvents } from "@/lib/use-events";
import type { PlatformKey } from "@/lib/platforms";
import type { ActiveUser, ConversationItem, MessageItem } from "@/lib/types";
import { ConversationList, type InboxFilters } from "./ConversationList";
import { MessageThread } from "./MessageThread";
import { ReplyBox } from "./ReplyBox";

type Props = {
  platforms: PlatformKey[];
  /** Vùng thêm bên phải khung tin nhắn (US3: bảng học sinh). */
  sidePanel?: (conversation: ConversationItem) => React.ReactNode;
};

export function Inbox({ platforms, sidePanel }: Props) {
  const [filters, setFilters] = useState<InboxFilters>({ platform: "", unreadOnly: false, assignee: "", q: "" });
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Cuộc trò chuyện đang mở, đọc được trong callback sự kiện mà không phải đăng ký lại.
  const selectedRef = useRef<string | null>(null);

  const loadList = useCallback(async () => {
    const p = new URLSearchParams();
    if (filters.platform) p.set("platform", filters.platform);
    if (filters.unreadOnly) p.set("unread", "true");
    if (filters.assignee) p.set("assignee", filters.assignee);
    if (filters.q.trim()) p.set("q", filters.q.trim());
    const res = await api<{ items: ConversationItem[] }>(`/api/conversations?${p}`);
    setItems(res.items);
  }, [filters]);

  const loadSelected = useCallback(async (id: string) => {
    const [d, m] = await Promise.all([
      api<ConversationItem>(`/api/conversations/${id}`),
      api<{ items: MessageItem[] }>(`/api/conversations/${id}/messages`),
    ]);
    if (selectedRef.current !== id) return;
    setDetail(d);
    setMessages(m.items);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void loadList().catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [loadList]);

  useEffect(() => {
    void api<{ items: ActiveUser[] }>("/api/users").then((r) => setUsers(r.items));
  }, []);

  const refreshAll = useCallback(() => {
    void loadList();
    if (selectedRef.current) void loadSelected(selectedRef.current);
  }, [loadList, loadSelected]);

  useEvents(
    {
      "conversation.updated": (d: { conversationId: string }) => {
        void loadList();
        if (d.conversationId === selectedRef.current) void loadSelected(d.conversationId);
      },
      "student.updated": () => selectedRef.current && void loadSelected(selectedRef.current),
      "student.deleted": () => selectedRef.current && void loadSelected(selectedRef.current),
    },
    refreshAll,
  );

  const select = async (id: string) => {
    setSelectedId(id);
    selectedRef.current = id;
    setError(null);
    await loadSelected(id);
    await api(`/api/conversations/${id}/read`, { method: "POST" });
    void loadList();
  };

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="inbox">
      <ConversationList
        items={items}
        selectedId={selectedId}
        onSelect={(id) => void run(() => select(id))}
        filters={filters}
        onFilters={setFilters}
        platforms={platforms}
      />
      <section className="conv-detail panel" aria-label="Cuộc trò chuyện">
        {!detail ? (
          <p className="muted pad">Chọn một cuộc trò chuyện để xem và trả lời.</p>
        ) : (
          <>
            <header className="conv-header">
              <strong>{detail.customerName}</strong>
              <span className="muted"> · {detail.channelName}</span>
            </header>
            <MessageThread
              messages={messages}
              onRetry={(id) =>
                void run(async () => {
                  await api(`/api/messages/${id}/retry`, { method: "POST" });
                  await loadSelected(detail.id);
                })
              }
            />
            {error && (
              <p className="error pad" role="alert">
                {error}
              </p>
            )}
            <ReplyBox
              conversation={detail}
              users={users}
              onSend={(text) =>
                run(async () => {
                  await api(`/api/conversations/${detail.id}/messages`, { method: "POST", body: { body: text } });
                  await loadSelected(detail.id);
                })
              }
              onAssign={(userId) =>
                run(async () => {
                  const d = await api<ConversationItem>(`/api/conversations/${detail.id}/assignee`, {
                    method: "PUT",
                    body: { userId },
                  });
                  setDetail(d);
                  await loadList();
                })
              }
            />
          </>
        )}
      </section>
      {detail && sidePanel && <aside className="conv-side panel">{sidePanel(detail)}</aside>}
    </div>
  );
}
