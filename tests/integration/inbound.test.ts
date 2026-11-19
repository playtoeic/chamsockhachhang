import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSimulator, simulatorState } from "@/server/channels/simulator";
import { onNewConversation } from "@/server/inbox/receive";
import { POST } from "@/app/api/webhooks/[platform]/route";
import { createConnection } from "../helpers/factory";
import { call } from "../helpers/http";

const at = (iso: string) => new Date(iso).toISOString();

async function webhook(events: unknown[], opts: { accountId?: string; signature?: string } = {}) {
  const raw = JSON.stringify({ accountId: opts.accountId ?? "sim-account", events });
  const req = new Request("http://localhost/api/webhooks/simulator", {
    method: "POST",
    headers: { "x-simulator-signature": opts.signature ?? signSimulator(raw) },
    body: raw,
  });
  const res = await POST(req, { params: Promise.resolve({ platform: "simulator" }) });
  return res.status;
}

const textEvent = (over: Record<string, unknown> = {}) => ({
  type: "message",
  threadId: "t1",
  messageId: "m1",
  customerName: "Khách trong sự kiện",
  text: "Xin chào trung tâm",
  sentAt: at("2026-11-16T03:00:00Z"),
  ...over,
});

let removeHandler = () => {};
beforeEach(async () => {
  simulatorState.reset();
  simulatorState.profiles.set("t1", { name: "Nguyễn Văn An", avatar: true });
  await createConnection();
});
afterEach(() => removeHandler());

describe("POST /api/webhooks/simulator — luồng tin đến", () => {
  it("tạo cuộc trò chuyện và tin; cuộc trò chuyện mới lấy tên và ảnh đại diện qua fetchProfile", async () => {
    expect(await webhook([textEvent()])).toBe(200);
    const conv = await prisma.conversation.findFirstOrThrow({ include: { messages: true } });
    expect(conv.customerName).toBe("Nguyễn Văn An");
    expect(conv.customerAvatarPath).toBeTruthy();
    expect(existsSync(path.join(process.env.UPLOAD_DIR!, conv.customerAvatarPath!))).toBe(true);
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0]).toMatchObject({
      direction: "inbound",
      kind: "text",
      body: "Xin chào trung tâm",
      status: "received",
      externalMessageId: "m1",
    });
  });

  it("fetchProfile lỗi thì dùng tên trong sự kiện và không có ảnh", async () => {
    simulatorState.failProfile = true;
    await webhook([textEvent()]);
    const conv = await prisma.conversation.findFirstOrThrow();
    expect(conv.customerName).toBe("Khách trong sự kiện");
    expect(conv.customerAvatarPath).toBeNull();
  });

  it("cùng externalMessageId gửi hai lần chỉ tạo một tin", async () => {
    await webhook([textEvent()]);
    await webhook([textEvent()]);
    expect(await prisma.message.count()).toBe(1);
  });

  it("cập nhật unread, lastMessageAt, lastInboundAt và replyWindowExpiresAt", async () => {
    await webhook([textEvent()]);
    const conv = await prisma.conversation.findFirstOrThrow();
    expect(conv.unread).toBe(true);
    expect(conv.lastMessageAt.toISOString()).toBe(at("2026-11-16T03:00:00Z"));
    expect(conv.lastInboundAt?.toISOString()).toBe(at("2026-11-16T03:00:00Z"));
    // Kênh giả lập khai báo thời hạn trả lời 24 giờ.
    expect(conv.replyWindowExpiresAt?.toISOString()).toBe(at("2026-11-17T03:00:00Z"));
  });

  it("echo của tin website đã gửi (trùng externalMessageId) không tạo tin mới", async () => {
    await webhook([textEvent()]);
    const conv = await prisma.conversation.findFirstOrThrow();
    const user = await prisma.user.create({ data: { email: "nv@gmail.com" } });
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "outbound",
        kind: "text",
        body: "Chào bạn",
        status: "sent",
        externalMessageId: "out-1",
        sentByUserId: user.id,
      },
    });
    await webhook([
      {
        type: "echo",
        threadId: "t1",
        messageId: "out-1",
        text: "Chào bạn",
        sentAt: at("2026-11-16T03:05:00Z"),
      },
    ]);
    expect(await prisma.message.count()).toBe(2);
  });

  it("echo không trùng là tin gửi từ ứng dụng gốc: outbound, sent, không có người gửi, không đổi unread", async () => {
    await webhook([textEvent()]);
    await prisma.conversation.updateMany({ data: { unread: false } });
    const before = await prisma.conversation.findFirstOrThrow();
    await webhook([
      {
        type: "echo",
        threadId: "t1",
        messageId: "app-1",
        text: "Trả lời trong app",
        sentAt: at("2026-11-16T04:00:00Z"),
      },
    ]);
    const conv = await prisma.conversation.findFirstOrThrow();
    const echo = await prisma.message.findFirstOrThrow({ where: { externalMessageId: "app-1" } });
    expect(echo).toMatchObject({
      direction: "outbound",
      status: "sent",
      sentByUserId: null,
      body: "Trả lời trong app",
    });
    expect(conv.unread).toBe(false);
    expect(conv.replyWindowExpiresAt?.toISOString()).toBe(
      before.replyWindowExpiresAt?.toISOString(),
    );
    expect(conv.lastMessageAt.toISOString()).toBe(at("2026-11-16T04:00:00Z"));
  });

  it("tài khoản không có kết nối thì bỏ qua và vẫn trả 200", async () => {
    expect(await webhook([textEvent()], { accountId: "tai-khoan-la" })).toBe(200);
    expect(await prisma.conversation.count()).toBe(0);
  });

  it("chữ ký sai trả 401 và không lưu gì", async () => {
    expect(await webhook([textEvent()], { signature: "sai" })).toBe(401);
    expect(await prisma.message.count()).toBe(0);
  });

  it("tin ảnh lưu bản sao; tải ảnh lỗi thì lưu kind = unsupported loại image", async () => {
    await webhook([
      textEvent({
        messageId: "img-ok",
        text: undefined,
        attachment: { type: "image", ref: "sim://image/1" },
      }),
      textEvent({
        messageId: "img-bad",
        text: undefined,
        attachment: { type: "image", ref: "sim://fail" },
      }),
    ]);
    const ok = await prisma.message.findFirstOrThrow({ where: { externalMessageId: "img-ok" } });
    const bad = await prisma.message.findFirstOrThrow({ where: { externalMessageId: "img-bad" } });
    expect(ok.kind).toBe("image");
    expect(existsSync(path.join(process.env.UPLOAD_DIR!, ok.mediaPath!))).toBe(true);
    expect(bad).toMatchObject({ kind: "unsupported", unsupportedType: "image" });
  });

  it("bộ xử lý 'cuộc trò chuyện mới' được gọi đúng một lần cho mỗi cuộc trò chuyện mới", async () => {
    const seen: string[] = [];
    removeHandler = onNewConversation(async (conv) => {
      seen.push(conv.externalThreadId);
    });
    await webhook([textEvent(), textEvent({ messageId: "m2" })]);
    await webhook([textEvent({ threadId: "t2", messageId: "m3" })]);
    expect(seen).toEqual(["t1", "t2"]);
  });
});

describe("GET /api/webhooks/simulator", () => {
  it("platform không có adapter trả 404", async () => {
    const { GET } = await import("@/app/api/webhooks/[platform]/route");
    const res = await call(GET, { params: { platform: "tiktok" } });
    expect(res.status).toBe(404);
  });
});
