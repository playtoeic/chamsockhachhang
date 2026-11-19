"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusLegend } from "@/components/StatusLegend";
import type { ChipStudent } from "@/components/NameChip";
import { api } from "@/lib/api";
import {
  addDays,
  slotEnd,
  slotLabel,
  vnToday,
  WEEKDAYS,
  weekStart,
  type SlotKey,
} from "@/lib/slots";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import type { StudentSummary } from "@/lib/student-types";
import { cellKey, ScheduleBoard, type Cell } from "./ScheduleBoard";

type WeekData = {
  week: string;
  days: string[];
  bookings: { studentId: string; date: string; slot: SlotKey; student: StudentSummary }[];
  unscheduled: StudentSummary[];
  elsewhere: { studentId: string; date: string; slot: SlotKey; student: StudentSummary }[];
};

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Mục Lịch: học thử — lưới theo từng tuần có ngày tháng (FR-016a, FR-018). */
export function TrialSchedule() {
  const [week, setWeek] = useState(() => weekStart(vnToday(new Date())));
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 200);
    return () => clearTimeout(t);
  }, [search]);

  const { data, reload, setData } = useData<WeekData>(
    `/api/trial-schedule?week=${week}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
  );
  useEvents(
    { "trial-schedule.updated": reload, "student.updated": reload, "student.deleted": reload },
    reload,
  );

  const days = data?.week === week ? data.days : [0, 1, 2, 3, 4, 5].map((i) => addDays(week, i));
  const columns = WEEKDAYS.map((d, i) => ({
    weekday: d.key,
    title: d.label,
    subtitle: ddmm(days[i]),
  }));

  const cells = useMemo(() => {
    const m = new Map<string, ChipStudent[]>();
    if (!data || data.week !== week) return m;
    for (const b of data.bookings) {
      const wd = data.days.indexOf(b.date) + 1;
      if (wd < 1) continue;
      const k = cellKey({ weekday: wd, slot: b.slot });
      m.set(k, [...(m.get(k) ?? []), b.student]);
    }
    return m;
  }, [data, week]);

  const dateOf = (cell: Cell) => days[cell.weekday - 1];

  const mutate = async (optimistic: (d: WeekData) => WeekData, call: () => Promise<unknown>) => {
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

  const findSummary = (id: string) =>
    data?.unscheduled.find((s) => s.id === id) ??
    data?.bookings.find((b) => b.studentId === id)?.student ??
    data?.elsewhere.find((b) => b.studentId === id)?.student;

  return (
    <div className="schedule-page">
      <div className="schedule-head">
        <h1>Lịch: học thử</h1>
        <div className="row">
          <button type="button" onClick={() => setWeek(addDays(week, -7))}>
            ← Tuần trước
          </button>
          <strong aria-live="polite">
            Tuần {ddmm(days[0])} – {ddmm(days[5])}
          </strong>
          <button type="button" onClick={() => setWeek(addDays(week, 7))}>
            Tuần sau →
          </button>
          <button type="button" onClick={() => setWeek(weekStart(vnToday(new Date())))}>
            Tuần này
          </button>
        </div>
        <StatusLegend />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <ScheduleBoard
        columns={columns}
        cells={cells}
        unscheduled={data?.unscheduled ?? []}
        search={search}
        onSearch={setSearch}
        isPast={(cell) => slotEnd(dateOf(cell), cell.slot) <= new Date()}
        extra={{
          title: "Đã có lịch tuần khác",
          items: (data?.week === week ? data.elsewhere : []).map((b) => ({
            student: b.student,
            note: `${ddmm(b.date)} · ${slotLabel(b.slot)}`,
          })),
        }}
        onDropToCell={(student, to) => {
          const date = dateOf(to);
          const summary = findSummary(student.id);
          void mutate(
            (d) => ({
              ...d,
              unscheduled: d.unscheduled.filter((s) => s.id !== student.id),
              elsewhere: d.elsewhere.filter((b) => b.studentId !== student.id),
              bookings: [
                ...d.bookings.filter((b) => b.studentId !== student.id),
                ...(summary
                  ? [{ studentId: student.id, date, slot: to.slot, student: summary }]
                  : []),
              ],
            }),
            () =>
              api(`/api/students/${student.id}/trial`, {
                method: "PUT",
                body: { date, slot: to.slot },
              }),
          );
        }}
        onDropToList={(student) => {
          const summary = findSummary(student.id);
          void mutate(
            (d) => ({
              ...d,
              bookings: d.bookings.filter((b) => b.studentId !== student.id),
              unscheduled: summary ? [summary, ...d.unscheduled] : d.unscheduled,
            }),
            () => api(`/api/students/${student.id}/trial`, { method: "DELETE" }),
          );
        }}
      />
    </div>
  );
}
