"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { NameChip, type ChipStudent } from "@/components/NameChip";
import { SLOTS, type SlotKey } from "@/lib/slots";

export type Cell = { weekday: number; slot: SlotKey };
export type From = "list" | Cell;
export const cellKey = (c: Cell) => `${c.weekday}:${c.slot}`;

type DragData = { student: ChipStudent; from: From };

// Thả vào ô nằm dưới con trỏ; nếu con trỏ không nằm trong ô nào (ví dụ dùng bàn phím) thì theo diện tích giao.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

function DraggableChip({
  student,
  from,
  action,
  idPrefix,
}: {
  student: ChipStudent;
  from: From;
  action?: React.ReactNode;
  idPrefix?: string;
}) {
  const id = `${idPrefix ?? (from === "list" ? "list" : cellKey(from))}|${student.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { student, from } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      className={`drag-chip${isDragging ? " dragging" : ""}`}
      {...listeners}
      {...attributes}
      aria-label={`Kéo ${student.name}`}
    >
      <NameChip student={student} compact={from !== "list"}>
        {action}
      </NameChip>
    </div>
  );
}

function DroppableCell({
  cell,
  label,
  past,
  children,
  count,
}: {
  cell: Cell;
  label: string;
  past?: boolean;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell:${cellKey(cell)}`, data: { cell } });
  return (
    <td
      ref={setNodeRef}
      className={`cell${isOver ? " over" : ""}${past ? " past" : ""}`}
      aria-label={label}
    >
      {count > 0 && <span className="cell-count">{count}</span>}
      <div className="cell-items">{children}</div>
    </td>
  );
}

function DroppableList({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "list" });
  return (
    <div ref={setNodeRef} className={`unscheduled-drop${isOver ? " over" : ""}`}>
      {children}
    </div>
  );
}

/**
 * Lưới 6 ngày × 4 khung giờ và danh sách chưa xếp, kéo thả bằng dnd-kit (FR-016, FR-017).
 * Kéo vào ô → onDropToCell; kéo từ ô về danh sách → onDropToList.
 */
export function ScheduleBoard({
  columns,
  cells,
  unscheduled,
  search,
  onSearch,
  onDropToCell,
  onDropToList,
  cellChipAction,
  isPast,
  listTitle = "Chưa xếp",
  extra,
}: {
  columns: { weekday: number; title: string; subtitle?: string }[];
  cells: Map<string, ChipStudent[]>;
  unscheduled: ChipStudent[];
  search: string;
  onSearch: (q: string) => void;
  onDropToCell: (student: ChipStudent, to: Cell, from: From) => void;
  onDropToList: (student: ChipStudent, from: Cell) => void;
  cellChipAction?: (student: ChipStudent, cell: Cell) => React.ReactNode;
  isPast?: (cell: Cell) => boolean;
  listTitle?: string;
  /** Nhóm thêm trong danh sách bên cạnh, kéo được vào ô (ví dụ học sinh có lịch ở tuần khác). */
  extra?: { title: string; items: { student: ChipStudent; note: string }[] };
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [active, setActive] = useState<ChipStudent | null>(null);

  const onDragStart = (e: DragStartEvent) => setActive((e.active.data.current as DragData).student);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const data = e.active.data.current as DragData | undefined;
    if (!data || !e.over) return;
    if (e.over.id === "list") {
      if (data.from !== "list") onDropToList(data.student, data.from);
      return;
    }
    const to = (e.over.data.current as { cell: Cell }).cell;
    if (data.from !== "list" && cellKey(data.from) === cellKey(to)) return;
    onDropToCell(data.student, to, data.from);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
    >
      <div className="board">
        <table className="grid" aria-label="Lưới lịch">
          <thead>
            <tr>
              <th className="slot-head" />
              {columns.map((c) => (
                <th key={c.weekday}>
                  {c.title}
                  {c.subtitle && <div className="muted small">{c.subtitle}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((s) => (
              <tr key={s.key}>
                <th className="slot-head">{s.label}</th>
                {columns.map((c) => {
                  const cell = { weekday: c.weekday, slot: s.key };
                  const items = cells.get(cellKey(cell)) ?? [];
                  return (
                    <DroppableCell
                      key={c.weekday}
                      cell={cell}
                      label={`${c.title}${c.subtitle ? ` ${c.subtitle}` : ""}, ${s.label}`}
                      past={isPast?.(cell)}
                      count={items.length}
                    >
                      {items.map((st) => (
                        <DraggableChip
                          key={st.id}
                          student={st}
                          from={cell}
                          action={cellChipAction?.(st, cell)}
                        />
                      ))}
                    </DroppableCell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <aside className="panel unscheduled" aria-label={listTitle}>
          <h3>
            {listTitle} <span className="muted">({unscheduled.length})</span>
          </h3>
          <input
            type="search"
            placeholder="Tìm tên"
            aria-label="Tìm học sinh chưa xếp"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          <DroppableList>
            {unscheduled.map((st) => (
              <DraggableChip key={st.id} student={st} from="list" />
            ))}
            {unscheduled.length === 0 && <p className="muted small">Không có học sinh nào.</p>}
          </DroppableList>
          {extra && extra.items.length > 0 && (
            <details className="extra-list">
              <summary>
                {extra.title} <span className="muted">({extra.items.length})</span>
              </summary>
              {extra.items.map(({ student, note }) => (
                <div key={student.id} className="extra-item">
                  <DraggableChip student={student} from="list" idPrefix="extra" />
                  <span className="muted small">{note}</span>
                </div>
              ))}
            </details>
          )}
        </aside>
      </div>
      <DragOverlay>{active ? <NameChip student={active} compact /> : null}</DragOverlay>
    </DndContext>
  );
}
