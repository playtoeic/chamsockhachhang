import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSimulator, simulatorState } from "@/server/channels/simulator";
import * as channels from "@/app/api/channels/route";
import * as connect from "@/app/api/channels/[platform]/connect/route";
import * as callback from "@/app/api/channels/[platform]/callback/route";
import * as one from "@/app/api/channels/[platform]/route";
import { POST as webhook } from "@/app/api/webhooks/[platform]/route";
import { createConnection, createConversation } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let staff: Awaited<ReturnType<typeof createSession>>;
let owner: Awaited<ReturnType<typeof createSession>>;

beforeEach(async () => {
  simulatorState.reset();
  staff = await createSession(prisma, { email: "lan@gmail.com" });
  owner = await createSession(prisma, { email: "owner@test.local", role: "owner" });
});

/** Đi hết luồng kết nối: connect → (trang cấp quyền) → callback, giữ cookie state. */
async function connectSimulator() {
  const start = await call(connect.POST, {
    method: "POST",
    cookie: owner.cookie,
    params: { platform: "simulator" },
  });
  expect(start.status).toBe(200);
  const redirect = new URL(start.json.redirectUrl);
  const stateCookie = start.headers.get("set-cookie")!.split(";")[0];
  return call(callback.GET, {
    url: redirect.toString(),
    cookie: `${owner.cookie}; ${stateCookie}`,
    params: { platform: "simulator" },
  });
}

describe("API kênh", () => {
  it("nhân viên gọi connect hoặc DELETE nhận 403", async () => {
    const conn = await createConnection();
    expect(
      (
        await call(connect.POST, {
          method: "POST",
          cookie: staff.cookie,
          params: { platform: "simulator" },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(one.DELETE, {
          method: "DELETE",
          cookie: staff.cookie,
          params: { platform: conn.id },
        })
      ).status,
    ).toBe(403);
  });

  it("GET không bao giờ trả credentials", async () => {
    await createConnection();
    const res = await call(channels.GET, { cookie: staff.cookie });
    expect(res.status).toBe(200);
    expect(res.json.items[0]).toMatchObject({ platform: "simulator", status: "connected" });
    expect(res.text).not.toContain("credentials");
  });

  it("platform không thuộc danh sách trả 404", async () => {
    const res = await call(connect.POST, {
      method: "POST",
      cookie: owner.cookie,
      params: { platform: "tiktok" },
    });
    expect(res.status).toBe(404);
  });

  it("callback sai state bị từ chối", async () => {
    const res = await call(callback.GET, {
      url: "http://localhost/api/channels/simulator/callback?code=sim&state=gia",
      cookie: owner.cookie,
      params: { platform: "simulator" },
    });
    expect(res.status).toBe(400);
    expect(await prisma.channelConnection.count()).toBe(0);
  });

  it("kết nối qua connect → callback tạo bản ghi đã mã hoá credentials", async () => {
    const res = await connectSimulator();
    expect(res.status).toBe(303);
    const conn = await prisma.channelConnection.findFirstOrThrow();
    expect(conn).toMatchObject({
      platform: "simulator",
      externalAccountId: "sim-account",
      status: "connected",
    });
    expect(conn.credentials).not.toContain("sim");
  });

  it("ngắt kết nối đặt disconnected, xoá credentials, giữ bản ghi và lịch sử tin nhắn", async () => {
    const conn = await createConnection();
    const conv = await createConversation(conn.id);
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: "inbound",
        kind: "text",
        body: "x",
        status: "received",
      },
    });
    const res = await call(one.DELETE, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { platform: conn.id },
    });
    expect(res.status).toBe(200);
    const after = await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(after).toMatchObject({ status: "disconnected", credentials: null });
    expect(await prisma.message.count()).toBe(1);
  });

  it("kết nối lại cùng tài khoản cập nhật bản ghi cũ và tin đến sau đó vào cuộc trò chuyện cũ", async () => {
    const conn = await createConnection();
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    await prisma.channelConnection.update({
      where: { id: conn.id },
      data: { status: "disconnected", credentials: null, lastError: "Token hết hạn" },
    });

    await connectSimulator();
    expect(await prisma.channelConnection.count()).toBe(1);
    const after = await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(after).toMatchObject({ status: "connected", lastError: null });

    const raw = JSON.stringify({
      accountId: "sim-account",
      events: [
        {
          type: "message",
          threadId: "t1",
          messageId: "m1",
          text: "Lại là tôi",
          sentAt: new Date().toISOString(),
        },
      ],
    });
    await webhook(
      new Request("http://localhost/api/webhooks/simulator", {
        method: "POST",
        headers: { "x-simulator-signature": signSimulator(raw) },
        body: raw,
      }),
      { params: Promise.resolve({ platform: "simulator" }) },
    );
    expect(await prisma.conversation.count()).toBe(1);
    expect(await prisma.message.count({ where: { conversationId: conv.id } })).toBe(1);
  });
});
