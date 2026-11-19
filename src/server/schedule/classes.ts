import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { notFound } from "@/server/http";
import { autoTick } from "@/server/students/steps";
import { toSummary } from "@/server/students/students";
import type { SlotKey } from "@/lib/slots";

const studentInclude = {
  steps: { where: { done: true }, select: { step: true } },
  trialBooking: { select: { date: true, slot: true } },
  _count: { select: { classSlots: true } },
} satisfies Prisma.StudentInclude;

async function ensureStudent(id: string) {
  const exists = await prisma.student.count({ where: { id } });
  if (!exists) throw notFound("Học sinh");
}

/**
 * Thêm một khung vào lịch học (FR-019); thả lại vào khung đã có thì không đổi gì. Khung đầu tiên
 * tự tick bước "xếp lịch học thật" (FR-026). Không đụng tới lịch học thử (FR-021).
 */
export async function addSlot(studentId: string, weekday: number, slot: SlotKey) {
  await ensureStudent(studentId);
  await prisma.$transaction(async (tx) => {
    await tx.classAssignment.createMany({ data: [{ studentId, weekday, slot }], skipDuplicates: true });
    await autoTick(tx, studentId, "class_scheduled");
  });
  publish("class-schedule.updated", { studentId });
  publish("student.updated", { studentId });
}

/** Gỡ đúng một khung (FR-020); không tự bỏ tick. */
export async function removeSlot(studentId: string, weekday: number, slot: SlotKey) {
  await ensureStudent(studentId);
  await prisma.classAssignment.deleteMany({ where: { studentId, weekday, slot } });
  publish("class-schedule.updated", { studentId });
  publish("student.updated", { studentId });
}

/** Toàn bộ lưới tuần lặp lại và danh sách học sinh chưa có khung nào (FR-016a, FR-017). */
export async function getGrid(q?: string, limit = 200) {
  const [assignments, unscheduled] = await Promise.all([
    prisma.classAssignment.findMany({
      include: { student: { include: studentInclude } },
      orderBy: [{ weekday: "asc" }, { slot: "asc" }, { student: { name: "asc" } }],
    }),
    prisma.student.findMany({
      where: {
        classSlots: { none: {} },
        ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" as const } } : {}),
      },
      include: studentInclude,
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
  ]);
  return {
    assignments: assignments.map((a) => ({
      studentId: a.studentId,
      weekday: a.weekday,
      slot: a.slot,
      student: toSummary(a.student),
    })),
    unscheduled: unscheduled.map(toSummary),
  };
}
