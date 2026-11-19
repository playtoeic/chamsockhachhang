import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { notFound, validation } from "@/server/http";

/** Các cặp hỏi–đáp mẫu (FR-028). Chủ soạn; mọi người tìm và đọc. */

const clean = (v: string, field: string) => {
  const t = v.trim();
  if (!t) throw validation(`${field} không được trống`);
  return t;
};

const select = {
  id: true,
  question: true,
  answer: true,
  updatedAt: true,
  updatedBy: { select: { id: true, name: true, email: true } },
} as const;

export async function listQa(q?: string) {
  const term = q?.trim();
  return prisma.qaEntry.findMany({
    where: term
      ? {
          OR: [
            { question: { contains: term, mode: "insensitive" } },
            { answer: { contains: term, mode: "insensitive" } },
          ],
        }
      : {},
    select,
    orderBy: { updatedAt: "desc" },
  });
}

export async function createQa(input: { question: string; answer: string }, userId: string) {
  const entry = await prisma.qaEntry.create({
    data: {
      question: clean(input.question, "Câu hỏi"),
      answer: clean(input.answer, "Câu trả lời"),
      updatedByUserId: userId,
    },
    select,
  });
  publish("qa.updated", {});
  return entry;
}

export async function updateQa(
  id: string,
  input: { question?: string; answer?: string },
  userId: string,
) {
  const exists = await prisma.qaEntry.count({ where: { id } });
  if (!exists) throw notFound("Mục hỏi–đáp");
  const entry = await prisma.qaEntry.update({
    where: { id },
    data: {
      ...(input.question !== undefined ? { question: clean(input.question, "Câu hỏi") } : {}),
      ...(input.answer !== undefined ? { answer: clean(input.answer, "Câu trả lời") } : {}),
      updatedByUserId: userId,
    },
    select,
  });
  publish("qa.updated", {});
  return entry;
}

export async function deleteQa(id: string) {
  const res = await prisma.qaEntry.deleteMany({ where: { id } });
  if (res.count === 0) throw notFound("Mục hỏi–đáp");
  publish("qa.updated", {});
}
