export type StepKey =
  "trial_scheduled" | "class_scheduled" | "entry_test" | "tuition_paid" | "commitment_signed";

/** 5 bước cố định, đúng thứ tự (FR-023). */
export const STEPS: { key: StepKey; label: string }[] = [
  { key: "trial_scheduled", label: "Xếp lịch học thử" },
  { key: "class_scheduled", label: "Xếp lịch học thật" },
  { key: "entry_test", label: "Làm test đầu vào" },
  { key: "tuition_paid", label: "Đóng học phí" },
  { key: "commitment_signed", label: "Ký cam kết" },
];

export const STEP_KEYS = STEPS.map((s) => s.key) as [StepKey, ...StepKey[]];

/** Số bước đã xong trên tổng 5 (FR-024). */
export function progress(rows: { step: string; done: boolean }[]): { done: number; total: number } {
  const done = new Set(
    rows.filter((r) => r.done && STEP_KEYS.includes(r.step as StepKey)).map((r) => r.step),
  );
  return { done: done.size, total: STEPS.length };
}
