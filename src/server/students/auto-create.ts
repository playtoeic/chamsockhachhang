import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { platformLabel } from "@/server/channels/registry";
import { onNewConversation } from "@/server/inbox/receive";

/**
 * Tự tạo hồ sơ học sinh cho mỗi cuộc trò chuyện mới (FR-012; data-model.md, Student "Tự tạo").
 * Chỉ chạy khi cuộc trò chuyện được tạo, nên xoá hồ sơ rồi khách nhắn tiếp không tạo lại.
 */
const g = globalThis as unknown as { __autoCreateRegistered?: boolean };

if (!g.__autoCreateRegistered) {
  g.__autoCreateRegistered = true;
  onNewConversation(async (conversation, connection) => {
    const student = await prisma.student.create({
      data: {
        name: conversation.customerName,
        source: platformLabel(connection.platform),
        avatarPath: conversation.customerAvatarPath,
        autoCreated: true,
        lastActivityAt: conversation.lastMessageAt,
      },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { studentId: student.id } });
    publish("student.updated", { studentId: student.id });
  });
}

export {};
