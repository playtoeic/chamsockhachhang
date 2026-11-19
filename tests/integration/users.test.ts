import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { canSignIn } from "@/server/auth/sign-in";
import { subscribe, type AppEvent } from "@/server/events/bus";
import * as users from "@/app/api/users/route";
import * as one from "@/app/api/users/[id]/route";
import { createConnection, createConversation } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let owner: Awaited<ReturnType<typeof createSession>>;
let staff: Awaited<ReturnType<typeof createSession>>;

beforeEach(async () => {
  owner = await createSession(prisma, { email: "owner@test.local", role: "owner", name: "Chủ" });
  staff = await createSession(prisma, { email: "lan@gmail.com", name: "Lan" });
});

const add = (cookie: string, email: string) => call(users.POST, { method: "POST", cookie, body: { email } });
const remove = (cookie: string, id: string) => call(one.DELETE, { method: "DELETE", cookie, params: { id } });

describe("thêm nhân viên (POST /api/users)", () => {
  it("chủ thêm email, lưu chữ thường, vai trò nhân viên; người đó đăng nhập được", async () => {
    const res = await add(owner.cookie, "  Minh.Tran@Gmail.com ");
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ email: "minh.tran@gmail.com", role: "staff" });
    expect(await canSignIn("minh.tran@gmail.com")).toBe(true);
  });

  it("email sai định dạng trả 400", async () => {
    expect((await add(owner.cookie, "khong-phai-email")).status).toBe(400);
  });

  it("email đang hoạt động (kể cả chủ) trả 409", async () => {
    expect((await add(owner.cookie, "lan@gmail.com")).status).toBe(409);
    expect((await add(owner.cookie, "owner@test.local")).status).toBe(409);
  });

  it("thêm lại email đã gỡ thì kích hoạt lại chính bản ghi cũ", async () => {
    await remove(owner.cookie, staff.user.id);
    const res = await add(owner.cookie, "lan@gmail.com");
    expect(res.status).toBe(201);
    expect(res.json.id).toBe(staff.user.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.user.id } })).active).toBe(true);
  });

  it("nhân viên gọi POST hoặc DELETE nhận 403", async () => {
    expect((await add(staff.cookie, "x@gmail.com")).status).toBe(403);
    expect((await remove(staff.cookie, owner.user.id)).status).toBe(403);
  });
});

describe("gỡ nhân viên (DELETE /api/users/{id})", () => {
  it("đặt active = false, xoá phiên, bỏ gán cuộc trò chuyện, giữ người gửi và người tick", async () => {
    const conn = await createConnection();
    const conv = await createConversation(conn.id, { assigneeUserId: staff.user.id });
    const msg = await prisma.message.create({
      data: { conversationId: conv.id, direction: "outbound", kind: "text", body: "x", status: "sent", sentByUserId: staff.user.id },
    });
    const student = await prisma.student.create({ data: { name: "An" } });
    await prisma.stepProgress.create({
      data: { studentId: student.id, step: "entry_test", done: true, doneByUserId: staff.user.id, doneAt: new Date() },
    });
    const events: AppEvent[] = [];
    const unsub = subscribe((e) => events.push(e));

    const res = await remove(owner.cookie, staff.user.id);
    unsub();

    expect(res.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: staff.user.id } })).active).toBe(false);
    expect(await prisma.session.count({ where: { userId: staff.user.id } })).toBe(0);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).assigneeUserId).toBeNull();
    expect((await prisma.message.findUniqueOrThrow({ where: { id: msg.id } })).sentByUserId).toBe(staff.user.id);
    const step = await prisma.stepProgress.findFirstOrThrow();
    expect(step.doneByUserId).toBe(staff.user.id);

    expect(events).toContainEqual({ type: "session.revoked", data: {}, toUserId: staff.user.id });
    expect(events).toContainEqual(expect.objectContaining({ type: "conversation.updated", data: { conversationId: conv.id } }));
  });

  it("phiên của người vừa bị gỡ nhận 401 ở yêu cầu kế tiếp và không đăng nhập lại được", async () => {
    await remove(owner.cookie, staff.user.id);
    await expect(
      requireUser(new Request("http://localhost/api/me", { headers: { cookie: staff.cookie } })),
    ).rejects.toMatchObject({ status: 401 });
    expect(await canSignIn("lan@gmail.com")).toBe(false);
  });

  it("gỡ chủ trả 400; id không tồn tại trả 404", async () => {
    expect((await remove(owner.cookie, owner.user.id)).status).toBe(400);
    expect((await remove(owner.cookie, "khong-co")).status).toBe(404);
  });
});
