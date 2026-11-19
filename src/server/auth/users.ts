import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { ApiError, notFound, validation } from "@/server/http";
import { normalizeEmail } from "./sign-in";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Thêm nhân viên bằng địa chỉ Gmail (FR-010); thêm lại email đã gỡ thì kích hoạt lại. */
export async function addStaff(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL.test(email)) throw validation("Địa chỉ email không hợp lệ");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.active || existing?.role === "owner") {
    throw new ApiError("conflict", 409, "Địa chỉ này đã có quyền truy cập");
  }
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { active: true, role: "staff" },
      })
    : await prisma.user.create({ data: { email, role: "staff", active: true } });
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/**
 * Gỡ nhân viên, có hiệu lực ngay: tắt tài khoản, xoá mọi phiên, bỏ gán các cuộc trò chuyện.
 * Không xoá bản ghi để giữ tên trên tin nhắn và bước đã tick (data-model.md, User).
 */
export async function removeStaff(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("Người dùng");
  if (user.role === "owner") throw validation("Không gỡ được chủ trung tâm");
  const conversations = await prisma.$transaction(async (tx) => {
    const assigned = await tx.conversation.findMany({
      where: { assigneeUserId: id },
      select: { id: true },
    });
    await tx.user.update({ where: { id }, data: { active: false } });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.conversation.updateMany({
      where: { assigneeUserId: id },
      data: { assigneeUserId: null },
    });
    return assigned;
  });
  publish("session.revoked", {}, { toUserId: id });
  for (const c of conversations) publish("conversation.updated", { conversationId: c.id });
}
