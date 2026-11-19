import { STEPS, type StepKey } from "@/lib/steps";

/** Thanh tiến độ 5 bước (FR-024). */
export function ProgressBar({ done }: { done: StepKey[] | number }) {
  const set = typeof done === "number" ? null : new Set(done);
  const count = typeof done === "number" ? done : set!.size;
  return (
    <div className="progress" aria-label={`Tiến độ ${count}/5`} role="img">
      <div className="progress-track">
        {STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`progress-seg${(set ? set.has(s.key) : i < count) ? " done" : ""}`}
            title={s.label}
          />
        ))}
      </div>
      <span className="progress-count">{count}/5</span>
    </div>
  );
}
