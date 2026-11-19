import { Avatar } from "./Avatar";
import { statusMeta } from "@/lib/status";
import type { StudentStatus } from "@/lib/types";

export type ChipStudent = {
  id: string;
  name: string;
  source: string | null;
  avatarUrl: string | null;
  status: StudentStatus;
};

/**
 * Ô tên học sinh (FR-013a, FR-017): tô màu theo trạng thái, ảnh đại diện hoặc chữ cái đầu, tên,
 * và dòng nguồn để phân biệt khi trùng tên.
 */
export function NameChip({
  student,
  compact,
  onClick,
  children,
}: {
  student: ChipStudent;
  compact?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const meta = statusMeta(student.status);
  return (
    <div
      className={`chip${compact ? " compact" : ""}`}
      style={{ borderColor: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, white)` }}
      data-status={student.status}
      title={`${student.name} — ${meta.label}${student.source ? ` — ${student.source}` : ""}`}
      onClick={onClick}
      aria-label={`${student.name}, ${meta.label}`}
    >
      <span className="chip-dot" style={{ background: meta.color }} aria-hidden />
      <Avatar name={student.name} url={student.avatarUrl} size={compact ? 20 : 26} />
      <span className="chip-text">
        <span className="chip-name">{student.name}</span>
        {student.source && <span className="chip-source">{student.source}</span>}
      </span>
      {children}
    </div>
  );
}
