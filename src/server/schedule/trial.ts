import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { notFound, validation } from "@/server/http";
import { autoTick } from "@/server/students/steps";
import { toSummary } from "@/server/students/students";
import { clock } from "@/lib/clock";
import {
  addDays,
  fromDbDate,
  isTrialDate,
  slotEnd,
  toDbDate,
  vnToday,
  weekDates,
  weekdayOf,
  type SlotKey,
} from "@/lib/slots";
import { markBooking } from "./auto-mark";

const studentInclude = {
  steps: { where: { done: true }, select: { step: true } },
  trialBooking: { select: { date: true, slot: true } },
  _count: { select: { classSlots: true } },
} satisfies Prisma.StudentInclude;

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2002" || e.code === "P2034");

/**
 * Tạo hoặc chuyển buổi học thử (FR-018): mỗi học sinh tối đa một buổi trên mọi tuần; thao tác sau
 * cùng thắng (data-model.md, "Quy tắc đồng thời").
 */
export async function setTrial(studentId: string, date: string, slot: SlotKey) {
  if (!isTrialDate(date)) throw validation("Ngày học thử phải từ thứ 2 tới thứ 7");
  const exists = await prisma.student.count({ where: { id: studentId } });
  if (!exists) throw notFound("Học sinh");

  const attempt = () =>
    prisma.$transaction(async (tx) => {
      const now = clock.now();
      const existed = await tx.trialBooking.count({ where: { studentId } });
      const booking = await tx.trialBooking.upsert({
        where: { studentId },
        create: { studentId, date: toDbDate(date), slot, autoMarkedAt: null },
        update: { date: toDbDate(date), slot, autoMarkedAt: null },
      });
      // Chỉ khi tạo buổi (chưa có buổi nào) mới tự tick; chuyển buổi thì không (data-model.md).
      if (existed === 0) await autoTick(tx, studentId, "trial_scheduled");
      if (slotEnd(date, slot) > now) {
        // 'đã học thử' do tự động mà được xếp lại sang tương lai thì về 'đang tham khảo' (FR-014b).
        await tx.student.updateMany({
          where: { id: studentId, status: "trialed", statusSource: "auto" },
          data: { status: "considering", statusSource: "auto" },
        });
      } else {
        // Xếp vào khung đã qua (ghi bù): áp dụng tự chuyển ngay.
        await markBooking(tx, booking, now);
      }
    });

  try {
    await attempt();
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    await attempt();
  }
  publish("trial-schedule.updated", { studentId });
  publish("student.updated", { studentId });
}

/** Gỡ buổi học thử; không đổi trạng thái và không tự bỏ tick. */
export async function removeTrial(studentId: string) {
  const exists = await prisma.student.count({ where: { id: studentId } });
  if (!exists) throw notFound("Học sinh");
  await prisma.trialBooking.deleteMany({ where: { studentId } });
  publish("trial-schedule.updated", { studentId });
  publish("student.updated", { studentId });
}

/** Lịch một tuần và danh sách học sinh chưa có buổi học thử nào (FR-017). */
export async function getWeek(monday: string, q?: string, limit = 200) {
  if (!isTrialDate(monday) || weekdayOf(monday) !== 1)
    throw validation("Tuần phải bắt đầu bằng ngày thứ 2");
  const today = vnToday(clock.now());
  const [bookings, unscheduled, elsewhere] = await Promise.all([
    prisma.trialBooking.findMany({
      where: { date: { gte: toDbDate(monday), lte: toDbDate(addDays(monday, 5)) } },
      include: { student: { include: studentInclude } },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
    }),
    prisma.student.findMany({
      where: {
        trialBooking: null,
        ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" as const } } : {}),
      },
      include: studentInclude,
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    // Buổi ở tuần khác (từ 14 ngày trước trở đi), để kéo được sang tuần đang xem (US4 kịch bản 8).
    prisma.trialBooking.findMany({
      where: {
        date: { gte: toDbDate(addDays(today, -14)) },
        NOT: { date: { gte: toDbDate(monday), lte: toDbDate(addDays(monday, 5)) } },
        ...(q?.trim()
          ? { student: { name: { contains: q.trim(), mode: "insensitive" as const } } }
          : {}),
      },
      include: { student: { include: studentInclude } },
      orderBy: [{ date: "asc" }, { slot: "asc" }],
      take: limit,
    }),
  ]);
  return {
    week: monday,
    days: weekDates(monday),
    bookings: bookings.map((b) => ({
      studentId: b.studentId,
      date: fromDbDate(b.date),
      slot: b.slot,
      student: toSummary(b.student),
    })),
    unscheduled: unscheduled.map(toSummary),
    elsewhere: elsewhere.map((b) => ({
      studentId: b.studentId,
      date: fromDbDate(b.date),
      slot: b.slot,
      student: toSummary(b.student),
    })),
  };
}
