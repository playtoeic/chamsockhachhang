import type { Platform, Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { forbidden, notFound, validation } from "@/server/http";
import type { CurrentUser } from "@/server/auth/guards";
import { mediaUrl } from "./media";

const include = {
  channelConnection: { select: { platform: true, displayName: true } },
  assignee: { select: { id: true, name: true, email: true } },
  student: { select: { id: true, name: true, status: true } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.ConversationInclude;

type Row = Prisma.ConversationGetPayload<{ include: typeof include }>;

function toDto(c: Row) {
  const last = c.messages[0];
  return {
    id: c.id,
    platform: c.channelConnection.platform,
    channelName: c.channelConnection.displayName,
    customerName: c.customerName,
    avatarUrl: mediaUrl(c.customerAvatarPath),
    unread: c.unread,
    lastMessageAt: c.lastMessageAt,
    replyWindowExpiresAt: c.replyWindowExpiresAt,
    assignee: c.assignee,
    student: c.student,
    lastMessage: last
      ? {
          direction: last.direction,
          kind: last.kind,
          body: last.body,
          unsupportedType: last.unsupportedType,
        }
      : null,
  };
}

export type ConversationFilter = {
  platform?: Platform;
  unread?: boolean;
  assignee?: "me" | "none" | string;
  q?: string;
  cursor?: string;
  limit?: number;
};

export async function listConversations(user: CurrentUser, f: ConversationFilter) {
  const where: Prisma.ConversationWhereInput = {};
  if (f.platform) where.channelConnection = { platform: f.platform };
  if (f.unread !== undefined) where.unread = f.unread;
  if (f.assignee === "me") where.assigneeUserId = user.id;
  else if (f.assignee === "none") where.assigneeUserId = null;
  else if (f.assignee) where.assigneeUserId = f.assignee;
  if (f.q?.trim()) where.customerName = { contains: f.q.trim(), mode: "insensitive" };

  const limit = Math.min(Math.max(f.limit ?? 50, 1), 100);
  const rows = await prisma.conversation.findMany({
    where,
    include,
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });
  const items = rows.slice(0, limit).map(toDto);
  return { items, nextCursor: rows.length > limit ? items[items.length - 1].id : null };
}

export async function getConversation(id: string) {
  const c = await prisma.conversation.findUnique({ where: { id }, include });
  if (!c) throw notFound("Cuộc trò chuyện");
  return toDto(c);
}

export async function listMessages(conversationId: string, cursor?: string, limit = 100) {
  const exists = await prisma.conversation.count({ where: { id: conversationId } });
  if (!exists) throw notFound("Cuộc trò chuyện");
  const rows = await prisma.message.findMany({
    where: { conversationId },
    include: { sentBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.reverse().map((m) => ({
      id: m.id,
      direction: m.direction,
      kind: m.kind,
      body: m.body,
      mediaUrl: mediaUrl(m.mediaPath),
      unsupportedType: m.unsupportedType,
      status: m.status,
      failureReason: m.failureReason,
      createdAt: m.createdAt,
      sentBy: m.sentBy,
      fromNativeApp: m.direction === "outbound" && !m.sentByUserId,
    })),
    // Cursor để tải các tin cũ hơn.
    nextCursor: rows.length > limit ? page[0].id : null,
  };
}

export async function markRead(id: string) {
  const res = await prisma.conversation.updateMany({ where: { id }, data: { unread: false } });
  if (res.count === 0) throw notFound("Cuộc trò chuyện");
  publish("conversation.updated", { conversationId: id });
}

/**
 * Đặt người phụ trách (FR-006a): nhân viên chỉ tự nhận (khi chưa ai nhận) hoặc bỏ nhận của chính
 * mình; chủ đặt ai cũng được.
 */
export async function setAssignee(actor: CurrentUser, id: string, userId: string | null) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) throw notFound("Cuộc trò chuyện");
  if (actor.role !== "owner") {
    const claimingSelf = userId === actor.id && (conv.assigneeUserId === null || conv.assigneeUserId === actor.id);
    const releasingOwn = userId === null && conv.assigneeUserId === actor.id;
    if (!claimingSelf && !releasingOwn) throw forbidden();
  }
  if (userId) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target?.active) throw validation("Người phụ trách không tồn tại hoặc đã bị gỡ");
  }
  await prisma.conversation.update({ where: { id }, data: { assigneeUserId: userId } });
  publish("conversation.updated", { conversationId: id });
  return getConversation(id);
}
