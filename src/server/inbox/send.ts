import type { Message } from "@prisma/client";
import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { ApiError, notFound, validation } from "@/server/http";
import { clock } from "@/lib/clock";
import { encrypt } from "@/server/crypto";
import { getAdapter } from "@/server/channels/registry";
import { SEND_ERROR_MESSAGES, type Credentials, type SendResult } from "@/server/channels/types";
import { credentialsOf } from "./receive";

const pending = new Set<Promise<void>>();

/** Chờ mọi lượt gửi đang chạy (dùng trong test). */
export async function flushDeliveries(): Promise<void> {
  const { flushSimulator } = await import("@/server/channels/simulator");
  while (pending.size) await Promise.all([...pending]);
  await flushSimulator();
}

function schedule(messageId: string) {
  const p = deliver(messageId)
    .catch((e) => console.error("[send] lỗi khi gửi", e))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/** Tạo tin trả lời ở trạng thái 'sending' và gửi trong nền; kết quả đến qua sự kiện (contracts/api.md). */
export async function sendReply(
  conversationId: string,
  userId: string,
  body: string,
): Promise<Message> {
  const text = body.trim();
  if (!text) throw validation("Nội dung trả lời không được trống");
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) throw notFound("Cuộc trò chuyện");
  const msg = await prisma.message.create({
    data: {
      conversationId,
      direction: "outbound",
      kind: "text",
      body: text,
      status: "sending",
      sentByUserId: userId,
      createdAt: clock.now(),
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: msg.createdAt },
  });
  publish("conversation.updated", { conversationId });
  schedule(msg.id);
  return msg;
}

/** Gửi lại tin 'failed' (FR-007). */
export async function retryMessage(messageId: string): Promise<Message> {
  const msg = await prisma.message.findUnique({ where: { id: messageId } });
  if (!msg) throw notFound("Tin nhắn");
  if (msg.status !== "failed")
    throw new ApiError("validation", 400, "Chỉ gửi lại được tin đã gửi thất bại");
  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { status: "sending", failureReason: null },
  });
  publish("conversation.updated", { conversationId: msg.conversationId });
  schedule(messageId);
  return updated;
}

async function deliver(messageId: string): Promise<void> {
  const msg = await prisma.message.findUniqueOrThrow({
    where: { id: messageId },
    include: { conversation: { include: { channelConnection: true } } },
  });
  const conv = msg.conversation;
  const conn = conv.channelConnection;
  const adapter = getAdapter(conn.platform);

  let result: SendResult;
  if (!adapter) {
    result = { ok: false, error: "disconnected", detail: "Kênh không còn được hỗ trợ" };
  } else if (conn.status !== "connected" || !conn.credentials) {
    result = { ok: false, error: "disconnected" };
  } else {
    let credentials: Credentials | null = credentialsOf(conn);
    if (adapter.refreshCredentials) {
      try {
        const fresh = await adapter.refreshCredentials(credentials, clock.now());
        if (fresh) {
          credentials = fresh;
          await prisma.channelConnection.update({
            where: { id: conn.id },
            data: { credentials: encrypt(JSON.stringify(fresh)) },
          });
        }
      } catch (e) {
        credentials = null;
        console.error(`[send ${conn.platform}] không làm mới được quyền truy cập`, e);
      }
    }
    if (!credentials) {
      result = {
        ok: false,
        error: "disconnected",
        detail: "Không làm mới được quyền truy cập, cần kết nối lại",
      };
    } else {
      try {
        result = await adapter.sendText(
          credentials,
          conv.externalThreadId,
          msg.body ?? "",
          conv.lastInboundAt,
          clock.now(),
        );
      } catch (e) {
        result = { ok: false, error: "unknown", detail: (e as Error).message };
      }
    }
  }

  if (result.ok) {
    const externalMessageId = result.externalMessageId;
    await prisma.$transaction(async (tx) => {
      // Echo của chính tin này có thể đã tới và được lưu như tin "gửi từ ứng dụng gốc": gộp lại.
      await tx.message.deleteMany({
        where: {
          conversationId: conv.id,
          externalMessageId,
          sentByUserId: null,
          id: { not: msg.id },
        },
      });
      await tx.message.update({
        where: { id: msg.id },
        data: { status: "sent", externalMessageId, failureReason: null },
      });
    });
  } else {
    await prisma.message.update({
      where: { id: msg.id },
      data: { status: "failed", failureReason: SEND_ERROR_MESSAGES[result.error] },
    });
    if (result.error === "disconnected" && conn.status === "connected") {
      await prisma.channelConnection.update({
        where: { id: conn.id },
        data: {
          status: "disconnected",
          lastError: result.detail ?? SEND_ERROR_MESSAGES.disconnected,
        },
      });
      publish("channel.updated", { channelId: conn.id });
    }
  }
  publish("conversation.updated", { conversationId: conv.id });
}
