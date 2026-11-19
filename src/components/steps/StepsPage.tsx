"use client";

import { useEffect, useState } from "react";
import { StatusLegend } from "@/components/StatusLegend";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import type { StudentDetail as Detail, StudentSummary } from "@/lib/student-types";
import { StudentDetail } from "./StudentDetail";
import { StudentList, type StudentFilters } from "./StudentList";

/** Mục Các bước: danh sách học sinh với tiến độ, chi tiết 5 bước, và phần Q&A. */
export function StepsPage({ qa }: { qa?: React.ReactNode }) {
  const [filters, setFilters] = useState<StudentFilters>({ status: "", pendingStep: "", q: "" });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (filters.status) p.set("status", filters.status);
    if (filters.pendingStep) p.set("pendingStep", filters.pendingStep);
    if (filters.q.trim()) p.set("q", filters.q.trim());
    const t = setTimeout(() => setQuery(p.toString()), 200);
    return () => clearTimeout(t);
  }, [filters]);

  const list = useData<{ items: StudentSummary[] }>(`/api/students?${query}`);
  const detail = useData<Detail>(selectedId ? `/api/students/${selectedId}` : null);

  const reloadAll = () => {
    list.reload();
    detail.reload();
  };
  useEvents(
    {
      "student.updated": reloadAll,
      "trial-schedule.updated": reloadAll,
      "class-schedule.updated": reloadAll,
      "student.deleted": (d: { studentId: string }) => {
        list.reload();
        if (d.studentId === selectedId) setSelectedId(null);
      },
    },
    reloadAll,
  );

  return (
    <div className="steps-page">
      <div className="steps-head">
        <h1>Các bước</h1>
        <StatusLegend />
      </div>
      <div className="steps-body">
        <StudentList
          items={list.data?.items ?? []}
          selectedId={selectedId}
          onSelect={setSelectedId}
          filters={filters}
          onFilters={setFilters}
          onCreated={(id) => {
            list.reload();
            setSelectedId(id);
          }}
        />
        <div className="panel pad steps-detail">
          {detail.data && detail.data.id === selectedId ? (
            <StudentDetail
              key={detail.data.id}
              student={detail.data}
              onChanged={reloadAll}
              onDeleted={() => {
                setSelectedId(null);
                list.reload();
              }}
            />
          ) : (
            <p className="muted">Bấm vào một học sinh để xem đã đến bước nào.</p>
          )}
        </div>
        {qa}
      </div>
    </div>
  );
}
