import type { PrismaClient, TrialBooking } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { publish } from "@/server/events/bus";
import { fromDbDate, slotEnd, toDbDate, vnToday, type SlotKey } from "@/lib/slots";

/**
 * Áp dụng quy tắc tự chuyển cho một buổi học thử (FR-014; data-model.md, Student "Chuyển trạng
 * thái"): nếu buổi đã qua giờ kết thúc và chưa được xử lý, ghi autoMarkedAt và chuyển học sinh đang
 * 'considering' sang 'trialed' (nguồn 'auto'). Học sinh ở trạng thái khác không bị đổi.
 * Trả true nếu trạng thái học sinh đã đổi.
 */
export async function markBooking(
  db: Tx | PrismaClient,
  booking: TrialBooking,
  now: Date,
): Promise<boolean> {
  if (booking.autoMarkedAt) return false;
  if (slotEnd(fromDbDate(booking.date), booking.slot as SlotKey) > now) return false;
  const claimed = await db.trialBooking.updateMany({
    where: {
      studentId: booking.studentId,
      autoMarkedAt: null,
      date: booking.date,
      slot: booking.slot,
    },
    data: { autoMarkedAt: now },
  });
  if (claimed.count === 0) return false;
  const changed = await db.student.updateMany({
    where: { id: booking.studentId, status: "considering" },
    data: { status: "trialed", statusSource: "auto" },
  });
  return changed.count > 0;
}

/** Chạy mỗi phút: xử lý mọi buổi đến hạn chưa được xử lý. */
export async function runAutoMark(now: Date): Promise<number> {
  const due = await prisma.trialBooking.findMany({
    where: { autoMarkedAt: null, date: { lte: toDbDate(vnToday(now)) } },
  });
  let changed = 0;
  for (const b of due) {
    if (slotEnd(fromDbDate(b.date), b.slot as SlotKey) > now) continue;
    const did = await prisma.$transaction((tx) => markBooking(tx, b, now));
    if (did) {
      changed++;
      publish("student.updated", { studentId: b.studentId });
      publish("trial-schedule.updated", { studentId: b.studentId });
    }
  }
  return changed;
}
