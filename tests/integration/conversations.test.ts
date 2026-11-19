import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { simulatorState } from "@/server/channels/simulator";
import { flushDeliveries } from "@/server/inbox/send";
import * as list from "@/app/api/conversations/route";
import * as one from "@/app/api/conversations/[id]/route";
import * as messages from "@/app/api/conversations/[id]/messages/route";
import * as read from "@/app/api/conversations/[id]/read/route";
import * as assignee from "@/app/api/conversations/[id]/assignee/route";
import * as retry from "@/app/api/messages/[id]/retry/route";
import { createConnection, createConversation } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let staff: Awaited<ReturnType<typeof createSession>>;
let other: Awaited<ReturnType<typeof createSession>>;
let owner: Awaited<ReturnType<typeof createSession>>;
let conn: Awaited<ReturnType<typeof createConnection>>;

beforeEach(async () => {
  simulatorState.reset();
  simulatorState.echoMode = "off";
  staff = await createSession(prisma, { email: "lan@gmail.com", name: "Lan" });
  other = await createSession(prisma, { email: "minh@gmail.com", name: "Minh" });
  owner = await createSession(prisma, { email: "owner@test.local", role: "owner", name: "Chủ" });
  conn = await createConnection();
});

const url = (q = "") => `http://localhost/api/conversations${q}`;

describe("GET /api/conversations", () => {
  it("sắp xếp theo tin mới nhất và lọc theo platform, unread, assignee, q", async () => {
    const fb = await createConnection("facebook", "page-1");
    const a = await createConversation(conn.id, {
      customerName: "Nguyễn An",
      lastMessageAt: new Date("2026-11-16T01:00:00Z"),
    });
    const b = await createConversation(fb.id, {
      customerName: "Trần Bình",
      lastMessageAt: new Date("2026-11-16T03:00:00Z"),
      unread: true,
      assigneeUserId: staff.user.id,
    });
    const c = await createConversation(conn.id, {
      customerName: "Lê Chi",
      lastMessageAt: new Date("2026-11-16T02:00:00Z"),
      assigneeUserId: other.user.id,
    });

    const ids = async (q: string) =>
      (await call(list.GET, { url: url(q), cookie: staff.cookie })).json.items.map(
        (i: { id: string }) => i.id,
      );

    expect(await ids("")).toEqual([b.id, c.id, a.id]);
    expect(await ids("?platform=facebook")).toEqual([b.id]);
    expect(await ids("?unread=true")).toEqual([b.id]);
    expect(await ids("?assignee=me")).toEqual([b.id]);
    expect(await ids("?assignee=none")).toEqual([a.id]);
    expect(await ids(`?assignee=${other.user.id}`)).toEqual([c.id]);
    expect(await ids("?q=chi")).toEqual([c.id]);

    const item = (await call(list.GET, { url: url(), cookie: staff.cookie })).json.items[0];
    expect(item).toMatchObject({
      platform: "facebook",
      customerName: "Trần Bình",
      unread: true,
      assignee: { id: staff.user.id, name: "Lan" },
    });
  });

  it("phân trang bằng cursor", async () => {
    for (let i = 0; i < 5; i++)
      await createConversation(conn.id, { lastMessageAt: new Date(Date.UTC(2026, 10, 16, i)) });
    const p1 = await call(list.GET, { url: url("?limit=2"), cookie: staff.cookie });
    expect(p1.json.items).toHaveLength(2);
    const p2 = await call(list.GET, {
      url: url(`?limit=2&cursor=${p1.json.nextCursor}`),
      cookie: staff.cookie,
    });
    expect(p2.json.items).toHaveLength(2);
    expect(p2.json.items[0].id).not.toBe(p1.json.items[1].id);
  });

  it("chi tiết cuộc trò chuyện không tồn tại trả 404", async () => {
    const res = await call(one.GET, { cookie: staff.cookie, params: { id: "khong-co" } });
    expect(res.status).toBe(404);
  });
});

describe("gửi trả lời", () => {
  it("ghi sentByUserId, trả 'sending' rồi chuyển 'sent' kèm externalMessageId", async () => {
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    const res = await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "Chào bạn" },
    });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      status: "sending",
      sentByUserId: staff.user.id,
      direction: "outbound",
    });
    await flushDeliveries();
    const msg = await prisma.message.findUniqueOrThrow({ where: { id: res.json.id } });
    expect(msg.status).toBe("sent");
    expect(msg.externalMessageId).toBeTruthy();
    expect(simulatorState.outbox.at(-1)).toMatchObject({ threadId: "t1", text: "Chào bạn" });
  });

  it("nội dung trống trả 400", async () => {
    const conv = await createConversation(conn.id);
    const res = await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "   " },
    });
    expect(res.status).toBe(400);
  });

  it("echo tới trước khi sendText trả về vẫn chỉ còn một tin và giữ người gửi", async () => {
    simulatorState.echoMode = "before";
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    const res = await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "Chào bạn" },
    });
    await flushDeliveries();
    const all = await prisma.message.findMany({ where: { conversationId: conv.id } });
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: res.json.id, status: "sent", sentByUserId: staff.user.id });
  });

  it("lỗi gửi chuyển 'failed' kèm lý do; retry chuyển 'failed → sending' rồi 'sent'", async () => {
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    simulatorState.rejectWith = "window_expired";
    const res = await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "Chào" },
    });
    await flushDeliveries();
    const failed = await prisma.message.findUniqueOrThrow({ where: { id: res.json.id } });
    expect(failed.status).toBe("failed");
    expect(failed.failureReason).toBe("Đã quá thời hạn trả lời trên kênh này");

    simulatorState.rejectWith = null;
    const r = await call(retry.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: res.json.id },
    });
    expect(r.status).toBe(200);
    expect(r.json.status).toBe("sending");
    await flushDeliveries();
    expect((await prisma.message.findUniqueOrThrow({ where: { id: res.json.id } })).status).toBe(
      "sent",
    );
  });

  it("retry tin không ở trạng thái failed trả 400", async () => {
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    const res = await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "Chào" },
    });
    await flushDeliveries();
    const r = await call(retry.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: res.json.id },
    });
    expect(r.status).toBe(400);
  });

  it("lỗi disconnected đặt kết nối về 'disconnected'", async () => {
    const conv = await createConversation(conn.id, { externalThreadId: "t1" });
    simulatorState.rejectWith = "disconnected";
    await call(messages.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
      body: { body: "Chào" },
    });
    await flushDeliveries();
    const c = await prisma.channelConnection.findUniqueOrThrow({ where: { id: conn.id } });
    expect(c.status).toBe("disconnected");
    expect(c.lastError).toBeTruthy();
  });

  it("danh sách tin theo thời gian, đánh dấu tin gửi từ ứng dụng gốc", async () => {
    const conv = await createConversation(conn.id);
    await prisma.message.createMany({
      data: [
        {
          conversationId: conv.id,
          direction: "inbound",
          kind: "text",
          body: "1",
          status: "received",
          createdAt: new Date("2026-11-16T01:00:00Z"),
        },
        {
          conversationId: conv.id,
          direction: "outbound",
          kind: "text",
          body: "2",
          status: "sent",
          createdAt: new Date("2026-11-16T02:00:00Z"),
        },
      ],
    });
    const res = await call(messages.GET, { cookie: staff.cookie, params: { id: conv.id } });
    expect(res.json.items.map((m: { body: string }) => m.body)).toEqual(["1", "2"]);
    expect(res.json.items[1]).toMatchObject({ fromNativeApp: true, sentBy: null });
  });
});

describe("đã đọc và người phụ trách", () => {
  it("đánh dấu đã đọc", async () => {
    const conv = await createConversation(conn.id, { unread: true });
    const res = await call(read.POST, {
      method: "POST",
      cookie: staff.cookie,
      params: { id: conv.id },
    });
    expect(res.status).toBe(200);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).unread).toBe(
      false,
    );
  });

  it("nhân viên tự nhận và tự bỏ nhận; gán người khác hoặc bỏ nhận của người khác thì 403", async () => {
    const conv = await createConversation(conn.id);
    const put = (who: typeof staff, userId: string | null) =>
      call(assignee.PUT, {
        method: "PUT",
        cookie: who.cookie,
        params: { id: conv.id },
        body: { userId },
      });

    expect((await put(staff, other.user.id)).status).toBe(403);
    expect((await put(staff, staff.user.id)).status).toBe(200);
    expect((await put(other, other.user.id)).status).toBe(403);
    expect((await put(other, null)).status).toBe(403);
    expect((await put(staff, null)).status).toBe(200);
    expect(
      (await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).assigneeUserId,
    ).toBeNull();
  });

  it("chủ gán ai cũng được; gán người không còn hoạt động trả 400", async () => {
    const conv = await createConversation(conn.id, { assigneeUserId: staff.user.id });
    const ok = await call(assignee.PUT, {
      method: "PUT",
      cookie: owner.cookie,
      params: { id: conv.id },
      body: { userId: other.user.id },
    });
    expect(ok.status).toBe(200);
    expect(ok.json.assignee).toMatchObject({ id: other.user.id });
    await prisma.user.update({ where: { id: staff.user.id }, data: { active: false } });
    const bad = await call(assignee.PUT, {
      method: "PUT",
      cookie: owner.cookie,
      params: { id: conv.id },
      body: { userId: staff.user.id },
    });
    expect(bad.status).toBe(400);
  });
});
