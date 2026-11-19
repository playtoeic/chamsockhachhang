import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { subscribe, type AppEvent } from "@/server/events/bus";
import * as list from "@/app/api/students/route";
import * as one from "@/app/api/students/[id]/route";
import * as convStudent from "@/app/api/conversations/[id]/student/route";
import { createConnection, createConversation, createStudent } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let cookie: string;
beforeEach(async () => {
  cookie = (await createSession(prisma, { email: "lan@gmail.com" })).cookie;
});

const create = (body: unknown) => call(list.POST, { method: "POST", cookie, body });
const link = (conversationId: string, studentId: string | null) =>
  call(convStudent.PUT, { method: "PUT", cookie, params: { id: conversationId }, body: { studentId } });

describe("tạo hồ sơ thủ công (FR-012a)", () => {
  it("mặc định 'đang tham khảo', nguồn tay, không tự tạo, lưu nguồn", async () => {
    const res = await create({ name: "  Khách B ", source: "Threads" });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({
      name: "Khách B",
      source: "Threads",
      status: "considering",
      statusSource: "manual",
      autoCreated: false,
      stepsDone: 0,
    });
  });

  it("tên trống trả 400", async () => {
    expect((await create({ name: "   " })).status).toBe(400);
  });

  it("tạo kèm conversationId thì gắn luôn", async () => {
    const conn = await createConnection();
    const conv = await createConversation(conn.id);
    const res = await create({ name: "An", conversationId: conv.id });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).studentId).toBe(res.json.id);
  });
});

describe("gắn cuộc trò chuyện (FR-012b)", () => {
  it("gắn cuộc trò chuyện thứ hai vào cùng học sinh", async () => {
    const conn = await createConnection();
    const s = await createStudent({ name: "An" });
    const c1 = await createConversation(conn.id, { studentId: s.id });
    const c2 = await createConversation(conn.id);
    expect((await link(c2.id, s.id)).status).toBe(200);
    const detail = await call(one.GET, { cookie, params: { id: s.id } });
    expect(detail.json.conversations.map((c: { id: string }) => c.id).sort()).toEqual([c1.id, c2.id].sort());
  });

  it("gắn sang học sinh khác thì hồ sơ tự tạo cũ còn trống bị xoá và phát student.deleted", async () => {
    const conn = await createConnection();
    const keep = await createStudent({ name: "An" });
    const auto = await createStudent({ name: "An (Zalo)", autoCreated: true });
    const conv = await createConversation(conn.id, { studentId: auto.id });
    const events: AppEvent[] = [];
    const unsub = subscribe((e) => events.push(e));
    await link(conv.id, keep.id);
    unsub();
    expect(await prisma.student.findUnique({ where: { id: auto.id } })).toBeNull();
    expect(events).toContainEqual(expect.objectContaining({ type: "student.deleted", data: { studentId: auto.id } }));
  });

  it("hồ sơ cũ được giữ nếu có lịch, có bước đã tick, còn cuộc trò chuyện khác hoặc tạo thủ công", async () => {
    const conn = await createConnection();
    const target = await createStudent({ name: "Đích" });

    const withTrial = await createStudent({ autoCreated: true });
    await prisma.trialBooking.create({ data: { studentId: withTrial.id, date: new Date("2026-11-17"), slot: "S1" } });
    const withClass = await createStudent({ autoCreated: true });
    await prisma.classAssignment.create({ data: { studentId: withClass.id, weekday: 1, slot: "S2" } });
    const withStep = await createStudent({ autoCreated: true });
    await prisma.stepProgress.create({ data: { studentId: withStep.id, step: "entry_test", done: true } });
    const withOther = await createStudent({ autoCreated: true });
    await createConversation(conn.id, { studentId: withOther.id });
    const manual = await createStudent({ autoCreated: false });

    for (const s of [withTrial, withClass, withStep, withOther, manual]) {
      const conv = await createConversation(conn.id, { studentId: s.id });
      await link(conv.id, target.id);
      expect(await prisma.student.findUnique({ where: { id: s.id } }), s.id).not.toBeNull();
    }
  });

  it("bỏ gắn (studentId = null) không xoá hồ sơ", async () => {
    const conn = await createConnection();
    const auto = await createStudent({ autoCreated: true });
    const conv = await createConversation(conn.id, { studentId: auto.id });
    await link(conv.id, null);
    expect(await prisma.student.findUnique({ where: { id: auto.id } })).not.toBeNull();
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).studentId).toBeNull();
  });
});

describe("sửa, lọc, xoá", () => {
  it("PATCH status luôn ghi statusSource = manual; PATCH source và note", async () => {
    const s = await createStudent();
    await prisma.student.update({ where: { id: s.id }, data: { statusSource: "auto", status: "trialed" } });
    const res = await call(one.PATCH, { method: "PATCH", cookie, params: { id: s.id }, body: { status: "considering", source: "TikTok", note: "Hỏi giá" } });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ status: "considering", statusSource: "manual", source: "TikTok", note: "Hỏi giá" });
    expect((await call(one.PATCH, { method: "PATCH", cookie, params: { id: s.id }, body: { status: "vip" } })).status).toBe(400);
  });

  it("lọc theo status, pendingStep, q; danh sách có avatarUrl dạng /api/media", async () => {
    const a = await createStudent({ name: "Nguyễn An", status: "trialed" });
    const b = await createStudent({ name: "Trần Bình" });
    await prisma.student.update({ where: { id: b.id }, data: { avatarPath: "abc.png" } });
    await prisma.stepProgress.create({ data: { studentId: a.id, step: "entry_test", done: true } });

    const ids = async (q: string) =>
      (await call(list.GET, { cookie, url: `http://localhost/api/students${q}` })).json.items.map((s: { id: string }) => s.id);
    expect(await ids("?status=trialed")).toEqual([a.id]);
    expect(await ids("?pendingStep=entry_test")).toEqual([b.id]);
    expect(await ids("?q=bình")).toEqual([b.id]);

    const all = (await call(list.GET, { cookie })).json.items;
    expect(all.find((s: { id: string }) => s.id === b.id).avatarUrl).toBe("/api/media/abc.png");
    expect(all.find((s: { id: string }) => s.id === a.id).stepsDone).toBe(1);
  });

  it("xoá học sinh xoá lịch và bước, giữ cuộc trò chuyện với studentId = null", async () => {
    const conn = await createConnection();
    const s = await createStudent();
    const conv = await createConversation(conn.id, { studentId: s.id });
    await prisma.trialBooking.create({ data: { studentId: s.id, date: new Date("2026-11-17"), slot: "S1" } });
    await prisma.classAssignment.create({ data: { studentId: s.id, weekday: 2, slot: "S3" } });
    await prisma.stepProgress.create({ data: { studentId: s.id, step: "entry_test", done: true } });

    expect((await call(one.DELETE, { method: "DELETE", cookie, params: { id: s.id } })).status).toBe(200);
    expect(await prisma.trialBooking.count()).toBe(0);
    expect(await prisma.classAssignment.count()).toBe(0);
    expect(await prisma.stepProgress.count()).toBe(0);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conv.id } })).studentId).toBeNull();
  });

  it("học sinh không tồn tại trả 404", async () => {
    expect((await call(one.GET, { cookie, params: { id: "khong-co" } })).status).toBe(404);
  });
});
