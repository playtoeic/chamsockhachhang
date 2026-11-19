"use client";

import { useState } from "react";
import { NameChip } from "@/components/NameChip";
import { StudentDetail } from "@/components/steps/StudentDetail";
import { api } from "@/lib/api";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import type { StudentDetail as Detail, StudentSummary } from "@/lib/student-types";
import type { ConversationItem } from "@/lib/types";

/** Hồ sơ học sinh của cuộc trò chuyện đang mở: xem tiến độ, gắn sang hồ sơ khác, bỏ gắn, tạo mới. */
export function StudentPanel({ conversation }: { conversation: ConversationItem }) {
  const studentId = conversation.student?.id ?? null;
  const detail = useData<Detail>(studentId ? `/api/students/${studentId}` : null);
  const [q, setQ] = useState("");
  const [linking, setLinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const search = useData<{ items: StudentSummary[] }>(
    linking && q.trim() ? `/api/students?q=${encodeURIComponent(q.trim())}` : null,
  );

  useEvents({ "student.updated": detail.reload }, detail.reload);

  const link = async (target: string | null) => {
    setError(null);
    try {
      const r = await api<{ removedStudentId: string | null }>(
        `/api/conversations/${conversation.id}/student`,
        {
          method: "PUT",
          body: { studentId: target },
        },
      );
      setNotice(
        r.removedStudentId ? "Đã gắn vào hồ sơ đã có; hồ sơ tự tạo trống đã được xoá." : null,
      );
      setLinking(false);
      setQ("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createNew = async () => {
    setError(null);
    try {
      await api("/api/students", {
        method: "POST",
        body: { name: conversation.customerName, conversationId: conversation.id },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="student-panel pad" aria-label="Hồ sơ học sinh">
      <h3>Hồ sơ học sinh</h3>
      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {studentId && detail.data?.id === studentId ? (
        <StudentDetail key={studentId} student={detail.data} onChanged={detail.reload} />
      ) : studentId ? (
        <p className="muted">Đang tải…</p>
      ) : (
        <>
          <p className="muted">Cuộc trò chuyện chưa gắn với học sinh nào.</p>
          <button type="button" className="primary" onClick={createNew}>
            Tạo hồ sơ mới
          </button>
        </>
      )}

      <div className="link-box">
        {linking ? (
          <>
            <input
              type="search"
              aria-label="Tìm học sinh để gắn"
              placeholder="Tìm tên học sinh đã có"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <ul className="link-results">
              {search.data?.items
                .filter((s) => s.id !== studentId)
                .slice(0, 8)
                .map((s) => (
                  <li key={s.id}>
                    <NameChip student={s} compact onClick={() => void link(s.id)} />
                  </li>
                ))}
            </ul>
            <button type="button" onClick={() => setLinking(false)}>
              Huỷ
            </button>
          </>
        ) : (
          <div className="row">
            <button type="button" onClick={() => setLinking(true)}>
              Gắn vào học sinh đã có
            </button>
            {studentId && (
              <button type="button" onClick={() => void link(null)}>
                Bỏ gắn
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
