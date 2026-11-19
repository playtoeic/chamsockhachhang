import { STATUSES } from "@/lib/status";

/** Bảng chú thích 4 màu trạng thái (FR-013a). */
export function StatusLegend() {
  return (
    <ul className="legend" aria-label="Chú thích màu">
      {STATUSES.map((s) => (
        <li key={s.key}>
          <span className="legend-swatch" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
