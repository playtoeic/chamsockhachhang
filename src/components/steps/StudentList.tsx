"use client";

import { useState } from "react";
import { NameChip } from "@/components/NameChip";
import { ProgressBar } from "@/components/ProgressBar";
import { api } from "@/lib/api";
import { STATUSES } from "@/lib/status";
import { STEPS } from "@/lib/steps";
import type { StudentSummary } from "@/lib/student-types";

export type StudentFilters = { status: string; pendingStep: string; q: string };

export function StudentList({
  items,
  selectedId,
  onSelect,
  filters,
  onFilters,
  onCreated,
}: {
  items: StudentSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: StudentFilters;
  onFilters: (f: StudentFilters) => void;
  onCreated: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const s = await api<StudentSummary>("/api/students", {
        method: "POST",
        body: { name, source },
      });
      setCreating(false);
      setName("");
      setSource("");
      onCreated(s.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="panel student-list" aria-label="Danh sách học sinh">
      <div className="conv-filters">
        <input
          type="search"
          placeholder="Tìm tên học sinh"
          aria-label="Tìm tên học sinh"
          value={filters.q}
          onChange={(e) => onFilters({ ...filters, q: e.target.value })}
        />
        <div className="row">
          <select
            aria-label="Lọc theo trạng thái"
            value={filters.status}
            onChange={(e) => onFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Mọi trạng thái</option>
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc theo bước chưa xong"
            value={filters.pendingStep}
            onChange={(e) => onFilters({ ...filters, pendingStep: e.target.value })}
          >
            <option value="">Mọi bước</option>
            {STEPS.map((s) => (
              <option key={s.key} value={s.key}>
                Chưa: {s.label}
              </option>
            ))}
          </select>
        </div>
        {creating ? (
          <form className="create-form" onSubmit={create}>
            <input
              aria-label="Tên học sinh mới"
              placeholder="Tên"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              aria-label="Nguồn"
              placeholder="Nguồn (ví dụ Threads, TikTok)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <div className="row">
              <button className="primary" type="submit">
                Tạo hồ sơ
              </button>
              <button type="button" onClick={() => setCreating(false)}>
                Huỷ
              </button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        ) : (
          <button type="button" onClick={() => setCreating(true)}>
            + Thêm học sinh
          </button>
        )}
      </div>
      <ul className="student-items">
        {items.map((s) => (
          <li
            key={s.id}
            className={s.id === selectedId ? "selected" : undefined}
            onClick={() => onSelect(s.id)}
            onKeyDown={(e) => e.key === "Enter" && onSelect(s.id)}
            tabIndex={0}
          >
            <NameChip student={s} />
            <ProgressBar done={s.stepsDone} />
          </li>
        ))}
        {items.length === 0 && <li className="muted pad">Không có học sinh nào.</li>}
      </ul>
    </section>
  );
}
