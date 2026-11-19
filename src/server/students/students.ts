import type { Prisma, Step, StudentStatus } from "@prisma/client";
import { prisma, type Tx } from "@/server/db";
import { publish } from "@/server/events/bus";
import { notFound, validation } from "@/server/http";
import { mediaUrl } from "@/server/inbox/media";
import { clock } from "@/lib/clock";
import { STEPS } from "@/lib/steps";

const summaryInclude = {
  steps: { where: { done: true }, select: { step: true } },
  trialBooking: { select: { date: true, slot: true } },
  _count: { select: { classSlots: true } },
} satisfies Prisma.StudentInclude;

type SummaryRow = Prisma.StudentGetPayload<{ include: typeof summaryInclude }>;

export function toSummary(s: SummaryRow) {
  return {
    id: s.id,
    name: s.name,
    source: s.source,
    avatarUrl: mediaUrl(s.avatarPath),
    note: s.note,
    status: s.status,
    statusSource: s.statusSource,
    autoCreated: s.autoCreated,
    lastActivityAt: s.lastActivityAt,
    stepsDone: s.steps.length,
    trial: s.trialBooking
      ? { date: s.trialBooking.date.toISOString().slice(0, 10), slot: s.trialBooking.slot }
      : null,
    classSlotCount: s._count.classSlots,
  };
}
export type StudentSummary = ReturnType<typeof toSummary>;

export const cleanName = (name: string) => {
  const n = name.trim().replace(/\s+/g, " ");
  if (!n) throw validation("Tên học sinh không được trống");
  return n;
};
const cleanOptional = (v: string | null | undefined) =>
  v === undefined ? undefined : v?.trim() || null;

export async function listStudents(f: {
  status?: StudentStatus;
  pendingStep?: Step;
  q?: string;
  limit?: number;
}) {
  const where: Prisma.StudentWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.pendingStep) where.steps = { none: { step: f.pendingStep, done: true } };
  if (f.q?.trim()) where.name = { contains: f.q.trim(), mode: "insensitive" };
  const rows = await prisma.student.findMany({
    where,
    include: summaryInclude,
    orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
    take: Math.min(f.limit ?? 500, 1000),
  });
  return rows.map(toSummary);
}

export async function getSummary(id: string) {
  const s = await prisma.student.findUnique({ where: { id }, include: summaryInclude });
  if (!s) throw notFound("Học sinh");
  return toSummary(s);
}

export async function getStudent(id: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      ...summaryInclude,
      steps: { include: { doneBy: { select: { id: true, name: true, email: true } } } },
      classSlots: { orderBy: [{ weekday: "asc" }, { slot: "asc" }] },
      conversations: {
        select: { id: true, customerName: true, channelConnection: { select: { platform: true } } },
      },
    },
  });
  if (!s) throw notFound("Học sinh");
  const byStep = new Map(s.steps.map((r) => [r.step, r]));
  return {
    ...toSummary({ ...s, steps: s.steps.filter((r) => r.done) }),
    steps: STEPS.map(({ key, label }) => {
      const r = byStep.get(key);
      return {
        step: key,
        label,
        done: !!r?.done,
        doneBy: r?.done ? r.doneBy : null,
        doneAt: r?.done ? r.doneAt : null,
      };
    }),
    classSlots: s.classSlots.map((c) => ({ weekday: c.weekday, slot: c.slot })),
    conversations: s.conversations.map((c) => ({
      id: c.id,
      customerName: c.customerName,
      platform: c.channelConnection.platform,
    })),
  };
}

export async function createStudent(input: {
  name: string;
  source?: string | null;
  note?: string | null;
  conversationId?: string;
}) {
  const student = await prisma.student.create({
    data: {
      name: cleanName(input.name),
      source: cleanOptional(input.source) ?? null,
      note: cleanOptional(input.note) ?? null,
      autoCreated: false,
      lastActivityAt: clock.now(),
    },
  });
  publish("student.updated", { studentId: student.id });
  if (input.conversationId) await linkConversation(input.conversationId, student.id);
  return getSummary(student.id);
}

export async function updateStudent(
  id: string,
  input: { name?: string; source?: string | null; note?: string | null; status?: StudentStatus },
) {
  const exists = await prisma.student.count({ where: { id } });
  if (!exists) throw notFound("Học sinh");
  await prisma.student.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: cleanName(input.name) } : {}),
      ...(input.source !== undefined ? { source: cleanOptional(input.source) } : {}),
      ...(input.note !== undefined ? { note: cleanOptional(input.note) } : {}),
      // Đổi trạng thái bằng tay luôn ghi nguồn 'manual' (FR-014a).
      ...(input.status !== undefined
        ? { status: input.status, statusSource: "manual" as const }
        : {}),
    },
  });
  publish("student.updated", { studentId: id });
  return getSummary(id);
}

export async function deleteStudent(id: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: { conversations: { select: { id: true } } },
  });
  if (!s) throw notFound("Học sinh");
  await prisma.student.delete({ where: { id } });
  publish("student.deleted", { studentId: id });
  publish("trial-schedule.updated", { studentId: id });
  publish("class-schedule.updated", { studentId: id });
  for (const c of s.conversations) publish("conversation.updated", { conversationId: c.id });
}

/** Hồ sơ tự tạo còn trống: không cuộc trò chuyện, không lịch, không bước đã tick (FR-012b). */
async function deleteIfEmptyAuto(tx: Tx, studentId: string): Promise<boolean> {
  const s = await tx.student.findUnique({
    where: { id: studentId },
    include: {
      _count: { select: { conversations: true, classSlots: true } },
      trialBooking: true,
      steps: { where: { done: true }, take: 1 },
    },
  });
  if (!s || !s.autoCreated) return false;
  if (s._count.conversations > 0 || s._count.classSlots > 0 || s.trialBooking || s.steps.length > 0)
    return false;
  await tx.student.delete({ where: { id: studentId } });
  return true;
}

/** Gắn hoặc bỏ gắn học sinh cho một cuộc trò chuyện. */
export async function linkConversation(conversationId: string, studentId: string | null) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw notFound("Cuộc trò chuyện");
  if (studentId) {
    const exists = await prisma.student.count({ where: { id: studentId } });
    if (!exists) throw notFound("Học sinh");
  }
  const previous = conv.studentId;
  const removed = await prisma.$transaction(async (tx) => {
    await tx.conversation.update({ where: { id: conversationId }, data: { studentId } });
    if (studentId && previous && previous !== studentId) {
      if (conv.lastMessageAt) {
        await tx.student.updateMany({
          where: { id: studentId, lastActivityAt: { lt: conv.lastMessageAt } },
          data: { lastActivityAt: conv.lastMessageAt },
        });
      }
      return (await deleteIfEmptyAuto(tx, previous)) ? previous : null;
    }
    return null;
  });
  publish("conversation.updated", { conversationId });
  if (studentId) publish("student.updated", { studentId });
  if (removed) publish("student.deleted", { studentId: removed });
  else if (previous && previous !== studentId) publish("student.updated", { studentId: previous });
  return { studentId, removedStudentId: removed };
}
