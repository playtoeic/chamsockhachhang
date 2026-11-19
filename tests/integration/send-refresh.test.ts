import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { registerAdapter } from "@/server/channels/registry";
import { zalo } from "@/server/channels/zalo";
import type { ChannelAdapter, Credentials } from "@/server/channels/types";
import { flushDeliveries, sendReply } from "@/server/inbox/send";
import { createConnection, createConversation } from "../helpers/factory";

/** Gửi tin trên kênh cần làm mới token (Zalo): token mới được lưu lại, lỗi làm mới thì mất kết nối. */
let sentWith: Credentials[] = [];
let refreshResult: Credentials | null | Error = null;

const fake: ChannelAdapter = {
  ...zalo,
  async refreshCredentials() {
    if (refreshResult instanceof Error) throw refreshResult;
    return refreshResult;
  },
  async sendText(credentials) {
    sentWith.push(credentials);
    return { ok: true, externalMessageId: `z-${sentWith.length}` };
  },
};

beforeEach(() => {
  sentWith = [];
  refreshResult = null;
  registerAdapter(fake);
});
afterEach(() => registerAdapter(zalo));

describe("làm mới thông tin truy cập trước khi gửi", () => {
  it("token được làm mới thì dùng token mới để gửi và lưu lại (đã mã hoá)", async () => {
    const conn = await createConnection("zalo", "oa-1");
    const conv = await createConversation(conn.id);
    const user = await prisma.user.create({ data: { email: "nv@gmail.com" } });
    refreshResult = { accessToken: "NEW", refreshToken: "R2", expiresAt: "2099-01-01T00:00:00Z" };
    await sendReply(conv.id, user.id, "chào");
    await flushDeliveries();
    expect(sentWith[0].accessToken).toBe("NEW");
    const saved = await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(JSON.parse(decrypt(saved.credentials!)).accessToken).toBe("NEW");
  });

  it("làm mới thất bại thì tin 'failed' và kênh chuyển mất kết nối", async () => {
    const conn = await createConnection("zalo", "oa-1");
    const conv = await createConversation(conn.id);
    const user = await prisma.user.create({ data: { email: "nv@gmail.com" } });
    refreshResult = new Error("refresh token hết hạn");
    const msg = await sendReply(conv.id, user.id, "chào");
    await flushDeliveries();
    expect(sentWith).toHaveLength(0);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).status).toBe("failed");
    expect((await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } })).status).toBe("disconnected");
  });
});
