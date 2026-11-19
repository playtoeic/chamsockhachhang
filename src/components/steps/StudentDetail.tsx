"use client";

import { useState } from "react";
import { NameChip } from "@/components/NameChip";
import { ProgressBar } from "@/components/ProgressBar";
import { api } from "@/lib/api";
import { STATUSES } from "@/lib/status";
import { PLATFORMS } from "@/lib/platforms";
import type { StudentDetail as Detail } from "@/lib/student-types";
import type { StudentStatus } from "@/lib/types";

const SLOT_LABEL: Record<string, string> = { S1: "9–11", S2: "14–16", S3: "18–20", S4: "20–22" };
const DAY_LABEL = ["", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

/** Chi tiết một học sinh: thanh tiến độ, 5 ô tick, trạng thái, sửa và xoá hồ sơ. */
export function StudentDetail({
  student,
  onChanged,
  onDeleted,
}: {
  student: Detail;
  onChanged: () => void;
  onDeleted?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: student.name, source: student.source ?? "", note: student.note ?? "" });
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Cập nhật lạc quan: ô tick đổi ngay khi bấm; hoàn tác nếu máy chủ báo lỗi. Giá trị tạm chỉ hiện
  // khi dữ liệu máy chủ còn như lúc bấm (`base`), nên thay đổi về sau của người khác vẫn hiện đúng.
  const [pending, setPending] = useState<Record<string, { value: boolean; base: boolean }>>({});
  const tick = async (step: string, done: boolean) => {
    const base = student.steps.find((s) => s.step === step)?.done ?? false;
    setPending((p) => ({ ...p, [step]: { value: done, base } }));
    setError(null);
    try {
      await api(`/api/students/${student.id}/steps/${step}`, { method: "PUT", body: { done } });
      onChanged();
    } catch (e) {
      setPending((p) => {
        const next = { ...p };
        delete next[step];
        return next;
      });
      setError((e as Error).message);
    }
  };
  const isDone = (s: { step: string; done: boolean }) => {
    const p = pending[s.step];
    return p && p.base === s.done ? p.value : s.done;
  };
  const setStatus = (status: StudentStatus) =>
    run(() => api(`/api/students/${student.id}`, { method: "PATCH", body: { status } }));

  return (
    <section className="student-detail" aria-label={`Chi tiết ${student.name}`}>
      <NameChip student={student} />
      <ProgressBar done={student.steps.filter(isDone).map((s) => s.step)} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <ul className="step-list" aria-label="Các bước">
        {student.steps.map((s) => (
          <li key={s.step}>
            <label className="check">
              <input type="checkbox" checked={isDone(s)} onChange={(e) => void tick(s.step, e.target.checked)} />
              {s.label}
            </label>
            {isDone(s) && s.done && (
              <span className="muted step-by">
                {s.doneBy ? (s.doneBy.name ?? s.doneBy.email) : "Tự động"}
                {s.doneAt ? ` · ${new Date(s.doneAt).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
              </span>
            )}
          </li>
        ))}
      </ul>

      <label className="field">
        Trạng thái
        <select value={student.status} onChange={(e) => setStatus(e.target.value as StudentStatus)}>
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="muted small">
        {student.trial ? `Học thử: ${student.trial.date} · ${SLOT_LABEL[student.trial.slot]}` : "Chưa xếp học thử"}
        <br />
        {student.classSlots.length
          ? `Lịch học: ${student.classSlots.map((c) => `${DAY_LABEL[c.weekday]} ${SLOT_LABEL[c.slot]}`).join(", ")}`
          : "Chưa xếp lịch học"}
        {student.conversations.length > 0 && (
          <>
            <br />
            Kênh: {student.conversations.map((c) => PLATFORMS[c.platform].label).join(", ")}
          </>
        )}
      </div>

      {editing ? (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api(`/api/students/${student.id}`, { method: "PATCH", body: form });
              setEditing(false);
            });
          }}
        >
          <label className="field">
            Tên
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label className="field">
            Nguồn
            <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </label>
          <label className="field">
            Ghi chú
            <textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
          <div className="row">
            <button className="primary" type="submit">
              Lưu
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Huỷ
            </button>
          </div>
        </form>
      ) : (
        <>
          {student.note && <p className="note">{student.note}</p>}
          <div className="row">
            <button
              type="button"
              onClick={() => {
                setForm({ name: student.name, source: student.source ?? "", note: student.note ?? "" });
                setEditing(true);
              }}
            >
              Sửa
            </button>
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (!confirm(`Xoá hồ sơ ${student.name}? Lịch và tiến độ của học sinh cũng bị xoá.`)) return;
                void run(async () => {
                  await api(`/api/students/${student.id}`, { method: "DELETE" });
                  onDeleted?.();
                });
              }}
            >
              Xoá hồ sơ
            </button>
          </div>
        </>
      )}
    </section>
  );
}
