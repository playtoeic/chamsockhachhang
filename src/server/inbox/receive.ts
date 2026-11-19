import { Prisma, type ChannelConnection, type Conversation } from "@prisma/client";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { publish } from "@/server/events/bus";
import { getAdapter } from "@/server/channels/registry";
import { simulatorState } from "@/server/channels/simulator";
import type { ChannelAdapter, Credentials, InboundMessage } from "@/server/channels/types";
import { saveMedia } from "./media";

/** Luồng xử lý sự kiện đến (contracts/channel-adapter.md, "Xử lý sự kiện đến"). */

export type NewConversationHandler = (
  conversation: Conversation,
  connection: ChannelConnection,
) => Promise<void>;

const g = globalThis as unknown as { __newConversationHandlers?: Set<NewConversationHandler> };
const handlers = (g.__newConversationHandlers ??= new Set());

/** Đăng ký bộ xử lý chạy khi có cuộc trò chuyện mới (US3 dùng để tự tạo hồ sơ học sinh). */
export function onNewConversation(handler: NewConversationHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

export function credentialsOf(conn: ChannelConnection): Credentials {
  if (!conn.credentials) throw new Error("Kênh chưa có thông tin truy cập");
  return JSON.parse(decrypt(conn.credentials)) as Credentials;
}

/** Xử lý webhook: trả 401 nếu chữ ký sai, 404 nếu không có adapter, 200 khi đã lưu. */
export async function receiveWebhook(platform: string, headers: Headers, rawBody: string): Promise<number> {
  const adapter = getAdapter(platform);
  if (!adapter) return 404;
  if (!adapter.verifyWebhook(headers, rawBody)) return 401;
  let events: InboundMessage[];
  try {
    events = adapter.parseWebhook(rawBody);
  } catch (e) {
    console.error(`[webhook ${platform}] không đọc được dữ liệu`, e);
    return 200;
  }
  for (const msg of events) {
    try {
      await processInbound(adapter, msg);
    } catch (e) {
      console.error(`[webhook ${platform}] lỗi xử lý tin ${msg.externalMessageId}`, e);
    }
  }
  return 200;
}

async function findOrCreateConversation(
  adapter: ChannelAdapter,
  conn: ChannelConnection,
  msg: InboundMessage,
): Promise<{ conversation: Conversation; isNew: boolean }> {
  const where = {
    channelConnectionId_externalThreadId: {
      channelConnectionId: conn.id,
      externalThreadId: msg.externalThreadId,
    },
  };
  const existing = await prisma.conversation.findUnique({ where });
  if (existing) return { conversation: existing, isNew: false };

  let name = msg.direction === "inbound" ? msg.customerName : undefined;
  let avatar: string | null = null;
  try {
    const creds = credentialsOf(conn);
    const profile = await adapter.fetchProfile(creds, msg.externalThreadId);
    if (profile.name) name = profile.name;
    if (profile.avatarRef) {
      const img = await adapter.fetchMedia(creds, profile.avatarRef);
      avatar = await saveMedia(img.data, img.contentType);
    }
  } catch (e) {
    console.warn(`[webhook ${adapter.platform}] không lấy được hồ sơ khách`, (e as Error).message);
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        channelConnectionId: conn.id,
        externalThreadId: msg.externalThreadId,
        customerName: name?.trim() || "Khách",
        customerAvatarPath: avatar,
        lastMessageAt: msg.sentAt,
      },
    });
    return { conversation, isNew: true };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return { conversation: await prisma.conversation.findUniqueOrThrow({ where }), isNew: false };
  }
}

async function processInbound(adapter: ChannelAdapter, msg: InboundMessage): Promise<void> {
  const conn = await prisma.channelConnection.findUnique({
    where: {
      platform_externalAccountId: { platform: adapter.platform, externalAccountId: msg.externalAccountId },
    },
  });
  if (!conn) return;

  const { conversation, isNew } = await findOrCreateConversation(adapter, conn, msg);

  const dup = await prisma.message.findUnique({
    where: {
      conversationId_externalMessageId: {
        conversationId: conversation.id,
        externalMessageId: msg.externalMessageId,
      },
    },
  });
  if (!dup) {
    let kind = msg.kind;
    let mediaPath: string | null = null;
    let unsupportedType = msg.unsupportedType ?? null;
    if (kind === "image" && msg.mediaRef) {
      try {
        const img = await adapter.fetchMedia(credentialsOf(conn), msg.mediaRef);
        mediaPath = await saveMedia(img.data, img.contentType);
      } catch {
        kind = "unsupported";
        unsupportedType = "image";
      }
    }
    try {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: msg.direction === "inbound" ? "inbound" : "outbound",
          kind,
          body: kind === "text" ? (msg.body ?? "") : null,
          mediaPath,
          unsupportedType: kind === "unsupported" ? unsupportedType : null,
          externalMessageId: msg.externalMessageId,
          status: msg.direction === "inbound" ? "received" : "sent",
          sentByUserId: null,
          createdAt: msg.sentAt,
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }

    const later = (d: Date | null) => (!d || msg.sentAt > d ? msg.sentAt : d);
    if (msg.direction === "inbound") {
      const hours = adapter.replyWindowHours();
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          unread: true,
          lastMessageAt: later(conversation.lastMessageAt),
          lastInboundAt: later(conversation.lastInboundAt),
          replyWindowExpiresAt:
            hours === null ? null : new Date(later(conversation.lastInboundAt).getTime() + hours * 3600_000),
        },
      });
      if (conversation.studentId) {
        await prisma.student.updateMany({
          where: { id: conversation.studentId, lastActivityAt: { lt: msg.sentAt } },
          data: { lastActivityAt: msg.sentAt },
        });
      }
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: later(conversation.lastMessageAt) },
      });
    }
  }

  if (isNew) {
    for (const h of handlers) {
      try {
        await h(conversation, conn);
      } catch (e) {
        console.error("[webhook] bộ xử lý cuộc trò chuyện mới bị lỗi", e);
      }
    }
  }
  publish("conversation.updated", { conversationId: conversation.id });
}

// Kênh giả lập giao echo thẳng vào luồng này (không qua HTTP).
simulatorState.deliver = async (rawBody) => {
  const { signSimulator } = await import("@/server/channels/simulator");
  await receiveWebhook("simulator", new Headers({ "x-simulator-signature": signSimulator(rawBody) }), rawBody);
};
