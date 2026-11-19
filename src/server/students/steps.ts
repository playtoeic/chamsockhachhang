import type { PrismaClient, Step } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { publish } from "@/server/events/bus";
import { notFound } from "@/server/http";
import { clock } from "@/lib/clock";

/** Tick hoặc bỏ tick một bước, ghi ai tick và khi nào (FR-025). */
export async function setStep(studentId: string, step: Step, done: boolean, userId: string) {
  const exists = await prisma.student.count({ where: { id: studentId } });
  if (!exists) throw notFound("Học sinh");
  const data = done
    ? { done: true, doneByUserId: userId, doneAt: clock.now() }
    : { done: false, doneByUserId: null, doneAt: null };
  await prisma.stepProgress.upsert({
    where: { studentId_step: { studentId, step } },
    create: { studentId, step, ...data },
    update: data,
  });
  publish("student.updated", { studentId });
}

/**
 * Tự tick một bước (FR-026) khi bước đang chưa xong; không ghi người tick. Không bao giờ tự bỏ tick.
 * Trả true nếu đã tick.
 */
export async function autoTick(
  db: Tx | PrismaClient,
  studentId: string,
  step: Step,
): Promise<boolean> {
  const current = await db.stepProgress.findUnique({
    where: { studentId_step: { studentId, step } },
  });
  if (current?.done) return false;
  await db.stepProgress.upsert({
    where: { studentId_step: { studentId, step } },
    create: { studentId, step, done: true, doneByUserId: null, doneAt: clock.now() },
    update: { done: true, doneByUserId: null, doneAt: clock.now() },
  });
  return true;
}
