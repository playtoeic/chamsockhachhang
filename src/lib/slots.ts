/**
 * Lưới lịch cố định (FR-016): thứ 2–thứ 7 và 4 khung giờ. Ngày là chuỗi "YYYY-MM-DD" theo giờ Việt
 * Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè).
 */

export type SlotKey = "S1" | "S2" | "S3" | "S4";

export const SLOTS: { key: SlotKey; start: number; end: number; label: string }[] = [
  { key: "S1", start: 9, end: 11, label: "9–11" },
  { key: "S2", start: 14, end: 16, label: "14–16" },
  { key: "S3", start: 18, end: 20, label: "18–20" },
  { key: "S4", start: 20, end: 22, label: "20–22" },
];
export const SLOT_KEYS = SLOTS.map((s) => s.key) as [SlotKey, ...SlotKey[]];

export const WEEKDAYS: { key: number; label: string }[] = [1, 2, 3, 4, 5, 6].map((k) => ({
  key: k,
  label: `Thứ ${k + 1}`,
}));

const VN_OFFSET_HOURS = 7;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parse(date: string): Date | null {
  const m = DATE_RE.exec(date);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.toISOString().slice(0, 10) === date ? d : null;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function isDate(date: string): boolean {
  return parse(date) !== null;
}

/** Ngày hôm nay theo giờ Việt Nam. */
export function vnToday(now: Date): string {
  return fmt(new Date(now.getTime() + VN_OFFSET_HOURS * 3600_000));
}

export function addDays(date: string, days: number): string {
  const d = parse(date);
  if (!d) throw new Error(`Ngày không hợp lệ: ${date}`);
  return fmt(new Date(d.getTime() + days * 86400_000));
}

/** 1 = thứ 2 … 6 = thứ 7, 7 = Chủ nhật. */
export function weekdayOf(date: string): number {
  const d = parse(date);
  if (!d) throw new Error(`Ngày không hợp lệ: ${date}`);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

/** Thứ 2 của tuần chứa ngày đã cho. */
export function weekStart(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

/** 6 ngày thứ 2–thứ 7 của tuần bắt đầu từ `monday`. */
export function weekDates(monday: string): string[] {
  return [0, 1, 2, 3, 4, 5].map((i) => addDays(monday, i));
}

/** Ngày hợp lệ cho buổi học thử: đúng định dạng và từ thứ 2 tới thứ 7. */
export function isTrialDate(date: string): boolean {
  return isDate(date) && weekdayOf(date) <= 6;
}

/** Thời điểm kết thúc của khung (UTC). */
export function slotEnd(date: string, slot: SlotKey): Date {
  const d = parse(date);
  const s = SLOTS.find((x) => x.key === slot);
  if (!d || !s) throw new Error(`Khung không hợp lệ: ${date} ${slot}`);
  return new Date(d.getTime() + (s.end - VN_OFFSET_HOURS) * 3600_000);
}

export const slotLabel = (slot: string) => SLOTS.find((s) => s.key === slot)?.label ?? slot;
export const weekdayLabel = (wd: number) =>
  WEEKDAYS.find((d) => d.key === wd)?.label ?? `Thứ ${wd + 1}`;

/** Chuyển ngày lưu trong cơ sở dữ liệu (@db.Date, 00:00 UTC) sang chuỗi và ngược lại. */
export const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const fromDbDate = (d: Date) => fmt(d);
