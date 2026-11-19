import type { StudentStatus } from "./types";

/** 4 trạng thái cố định, mỗi trạng thái một màu (FR-013). Màu định nghĩa trong globals.css. */
export const STATUSES: { key: StudentStatus; label: string; colorName: string; color: string }[] = [
  {
    key: "considering",
    label: "Đang tham khảo",
    colorName: "đỏ",
    color: "var(--status-considering)",
  },
  { key: "trialed", label: "Đã học thử", colorName: "xanh lá", color: "var(--status-trialed)" },
  {
    key: "enrolled",
    label: "Đã đăng ký",
    colorName: "xanh dương",
    color: "var(--status-enrolled)",
  },
  { key: "dropped", label: "Ngừng theo", colorName: "xám", color: "var(--status-dropped)" },
];

export function statusMeta(key: StudentStatus) {
  return STATUSES.find((s) => s.key === key) ?? STATUSES[0];
}
