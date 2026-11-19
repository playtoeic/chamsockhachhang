"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusLegend } from "@/components/StatusLegend";
import type { ChipStudent } from "@/components/NameChip";
import { api } from "@/lib/api";
import { slotLabel, WEEKDAYS, weekdayLabel, type SlotKey } from "@/lib/slots";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import type { StudentSummary } from "@/lib/student-types";
import { cellKey, ScheduleBoard, type Cell } from "./ScheduleBoard";

type GridData = {
  assignments: { studentId: string; weekday: number; slot: SlotKey; student: StudentSummary }[];
  unscheduled: StudentSummary[];
};

/**
 * Mục Lịch: xếp lịch học — một lưới tuần lặp lại, không gắn ngày (FR-016a). Một học sinh ở được
 * nhiều khung; kéo từ danh sách hoặc từ khung khác đều là thêm khung (FR-019).
 */
export function ClassSchedule() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, reload, setData } = useData<GridData>(
    `/api/class-schedule${q ? `?q=${encodeURIComponent(q)}` : ""}`,
  );
  useEvents(
    { "class-schedule.updated": reload, "student.updated": reload, "student.deleted": reload },
    reload,
  );

  const cells = useMemo(() => {
    const m = new Map<string, ChipStudent[]>();
    for (const a of data?.assignments ?? []) {
      const k = cellKey({ weekday: a.weekday, slot: a.slot });
      m.set(k, [...(m.get(k) ?? []), a.student]);
    }
    return m;
  }, [data]);

  const summaryOf = (id: string) =>
    data?.unscheduled.find((s) => s.id === id) ??
    data?.assignments.find((a) => a.studentId === id)?.student;

  const mutate = async (optimistic: (d: GridData) => GridData, call: () => Promise<unknown>) => {
    setError(null);
    if (data) setData(optimistic(data));
    try {
      await call();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      reload();
    }
  };

  const add = (student: ChipStudent, to: Cell) => {
    const summary = summaryOf(student.id);
    void mutate(
      (d) => ({
        unscheduled: d.unscheduled.filter((s) => s.id !== student.id),
        assignments: d.assignments.some(
          (a) => a.studentId === student.id && a.weekday === to.weekday && a.slot === to.slot,
        )
          ? d.assignments
          : [
              ...d.assignments,
              ...(summary
                ? [{ studentId: student.id, weekday: to.weekday, slot: to.slot, student: summary }]
                : []),
            ],
      }),
      () =>
        api(`/api/students/${student.id}/class-slots/${to.weekday}/${to.slot}`, { method: "PUT" }),
    );
  };

  const remove = (student: ChipStudent, from: Cell) => {
    void mutate(
      (d) => ({
        ...d,
        assignments: d.assignments.filter(
          (a) =>
            !(a.studentId === student.id && a.weekday === from.weekday && a.slot === from.slot),
        ),
      }),
      () =>
        api(`/api/students/${student.id}/class-slots/${from.weekday}/${from.slot}`, {
          method: "DELETE",
        }),
    );
  };

  return (
    <div className="schedule-page">
      <div className="schedule-head">
        <h1>Lịch: xếp lịch học</h1>
        <span className="muted">Lịch tuần lặp lại. Một học sinh có thể ở nhiều khung.</span>
        <StatusLegend />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ScheduleBoard
        columns={WEEKDAYS.map((d) => ({ weekday: d.key, title: d.label }))}
        cells={cells}
        unscheduled={data?.unscheduled ?? []}
        search={search}
        onSearch={setSearch}
        listTitle="Chưa có khung học"
        onDropToCell={(student, to) => add(student, to)}
        onDropToList={(student, from) => remove(student, from)}
        cellChipAction={(student, cell) => (
          <button
            type="button"
            className="chip-remove"
            aria-label={`Gỡ ${student.name} khỏi ${weekdayLabel(cell.weekday)} ${slotLabel(cell.slot)}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => remove(student, cell)}
          >
            ×
          </button>
        )}
      />
    </div>
  );
}
