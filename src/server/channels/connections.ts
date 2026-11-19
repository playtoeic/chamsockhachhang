import { randomBytes } from "node:crypto";
import { prisma } from "@/server/db";
import { encrypt } from "@/server/crypto";
import { publish } from "@/server/events/bus";
import { ApiError, notFound } from "@/server/http";
import { clock } from "@/lib/clock";
import { getAdapter, listPlatforms } from "./registry";

export const STATE_COOKIE = "channel_oauth_state";

const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const callbackUrl = (platform: string) => `${appUrl()}/api/channels/${platform}/callback`;

export async function listConnections() {
  const rows = await prisma.channelConnection.findMany({ orderBy: { connectedAt: "asc" } });
  return {
    platforms: listPlatforms().map((a) => ({ platform: a.platform, label: a.label })),
    items: rows.map((c) => ({
      id: c.id,
      platform: c.platform,
      displayName: c.displayName,
      status: c.status,
      lastError: c.lastError,
      connectedAt: c.connectedAt,
    })),
  };
}

/** Bắt đầu kết nối: trả địa chỉ trang cấp quyền và giá trị state để chống giả mạo yêu cầu. */
export function beginConnect(platform: string): { redirectUrl: string; state: string } {
  const adapter = getAdapter(platform);
  if (!adapter) throw notFound("Kênh");
  const state = `${platform}.${randomBytes(16).toString("hex")}`;
  return { redirectUrl: adapter.beginConnect(callbackUrl(platform), state), state };
}

/**
 * Hoàn tất kết nối. Kết nối lại cùng tài khoản (cùng platform, externalAccountId) cập nhật bản
 * ghi cũ để các cuộc trò chuyện cũ tiếp tục nhận tin (data-model.md, ChannelConnection).
 */
export async function completeConnect(
  platform: string,
  params: URLSearchParams,
  expectedState: string | null,
) {
  const adapter = getAdapter(platform);
  if (!adapter) throw notFound("Kênh");
  const state = params.get("state");
  if (!state || !expectedState || state !== expectedState || !state.startsWith(`${platform}.`)) {
    throw new ApiError(
      "invalid_state",
      400,
      "Yêu cầu kết nối không hợp lệ hoặc đã hết hạn, vui lòng thử lại",
    );
  }
  const result = await adapter.completeConnect(params, callbackUrl(platform));
  const data = {
    displayName: result.displayName,
    status: "connected" as const,
    credentials: encrypt(JSON.stringify(result.credentials)),
    lastError: null,
    connectedAt: clock.now(),
  };
  const conn = await prisma.channelConnection.upsert({
    where: {
      platform_externalAccountId: {
        platform: adapter.platform,
        externalAccountId: result.externalAccountId,
      },
    },
    create: { platform: adapter.platform, externalAccountId: result.externalAccountId, ...data },
    update: data,
  });
  publish("channel.updated", { channelId: conn.id });
  return conn;
}

/** Ngắt kết nối: giữ bản ghi và lịch sử, xoá thông tin truy cập. */
export async function disconnect(id: string) {
  const res = await prisma.channelConnection.updateMany({
    where: { id },
    data: { status: "disconnected", credentials: null, lastError: null },
  });
  if (res.count === 0) throw notFound("Kênh");
  publish("channel.updated", { channelId: id });
}
