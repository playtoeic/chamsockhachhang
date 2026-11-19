import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { setTestNow } from "@/lib/clock";
import * as week from "@/app/api/trial-schedule/route";
import * as trial from "@/app/api/students/[id]/trial/route";
import { createStudent } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let cookie: string;
// Thứ 2, 16/11/2026, 10:00 giờ Việt Nam.
const NOW = new Date("2026-11-16T03:00:00Z");

beforeEach(async () => {
  setTestNow(NOW);
  cookie = (await createSession(prisma, { email: "lan@gmail.com" })).cookie;
});
afterEach(() => setTestNow(null));

const put = (id: string, date: string, slot: string) =>
  call(trial.PUT, { method: "PUT", cookie, params: { id }, body: { date, slot } });
const del = (id: string) => call(trial.DELETE, { method: "DELETE", cookie, params: { id } });
const getWeek = (w: string, q = "") =>
  call(week.GET, {
    cookie,
    url: `http://localhost/api/trial-schedule?week=${w}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
  });

describe("xếp lịch học thử", () => {
  it("PUT tạo buổi và tự tick 'xếp lịch học thử'", async () => {
    const s = await createStudent();
    const res = await put(s.id, "2026-11-18", "S3");
    expect(res.status).toBe(200);
    const b = await prisma.trialBooking.findUniqueOrThrow({ where: { studentId: s.id } });
    expect(b.date.toISOString().slice(0, 10)).toBe("2026-11-18");
    expect(b.slot).toBe("S3");
    expect(
      await prisma.stepProgress.findFirst({
        where: { studentId: s.id, step: "trial_scheduled", done: true },
      }),
    ).not.toBeNull();
  });

  it("PUT lần hai (cùng tuần hoặc khác tuần) chuyển buổi, không bao giờ có hai bản ghi; đặt lại autoMarkedAt", async () => {
    const s = await createStudent();
    await put(s.id, "2026-11-18", "S3");
    await prisma.trialBooking.update({
      where: { studentId: s.id },
      data: { autoMarkedAt: new Date() },
    });
    await put(s.id, "2026-11-19", "S1");
    await put(s.id, "2026-11-25", "S2");
    expect(await prisma.trialBooking.count()).toBe(1);
    const b = await prisma.trialBooking.findUniqueOrThrow({ where: { studentId: s.id } });
    expect([b.date.toISOString().slice(0, 10), b.slot, b.autoMarkedAt]).toEqual([
      "2026-11-25",
      "S2",
      null,
    ]);
  });

  it("hai PUT đồng thời vẫn chỉ còn một buổi", async () => {
    const s = await createStudent();
    await Promise.all([put(s.id, "2026-11-18", "S3"), put(s.id, "2026-11-20", "S4")]);
    expect(await prisma.trialBooking.count()).toBe(1);
  });

  it("Chủ nhật hoặc khung sai trả 400; học sinh không tồn tại trả 404", async () => {
    const s = await createStudent();
    expect((await put(s.id, "2026-11-22", "S1")).status).toBe(400);
    expect((await put(s.id, "2026-11-18", "S9")).status).toBe(400);
    expect((await put("khong-co", "2026-11-18", "S1")).status).toBe(404);
  });

  it("DELETE gỡ buổi, không tự bỏ tick và không đổi trạng thái (kể cả 'đã học thử' tự động)", async () => {
    const s = await createStudent();
    await put(s.id, "2026-11-18", "S3");
    await prisma.student.update({
      where: { id: s.id },
      data: { status: "trialed", statusSource: "auto" },
    });
    expect((await del(s.id)).status).toBe(200);
    expect(await prisma.trialBooking.count()).toBe(0);
    const after = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    expect(after.status).toBe("trialed");
    expect(
      await prisma.stepProgress.findFirst({
        where: { studentId: s.id, step: "trial_scheduled", done: true },
      }),
    ).not.toBeNull();
  });

  it("PUT vào khung đã qua chuyển 'đang tham khảo → đã học thử' ngay trong cùng yêu cầu", async () => {
    const s = await createStudent();
    await put(s.id, "2026-11-14", "S1"); // thứ 7 tuần trước
    const after = await prisma.student.findUniqueOrThrow({ where: { id: s.id } });
    expect([after.status, after.statusSource]).toEqual(["trialed", "auto"]);
    expect((await prisma.trialBooking.findFirstOrThrow()).autoMarkedAt).not.toBeNull();
  });

  it("'đã học thử' tự động được xếp lại sang tương lai thì về 'đang tham khảo'; nguồn tay thì giữ", async () => {
    const a = await createStudent();
    const b = await createStudent();
    await prisma.student.update({
      where: { id: a.id },
      data: { status: "trialed", statusSource: "auto" },
    });
    await prisma.student.update({
      where: { id: b.id },
      data: { status: "trialed", statusSource: "manual" },
    });
    await put(a.id, "2026-11-20", "S2");
    await put(b.id, "2026-11-20", "S2");
    expect((await prisma.student.findUniqueOrThrow({ where: { id: a.id } })).status).toBe(
      "considering",
    );
    expect((await prisma.student.findUniqueOrThrow({ where: { id: b.id } })).status).toBe(
      "trialed",
    );
  });
});

describe("GET /api/trial-schedule", () => {
  it("trả đúng buổi của tuần và danh sách chưa xếp gồm mọi học sinh chưa có buổi", async () => {
    const inWeek = await createStudent({ name: "Trong tuần" });
    const nextWeek = await createStudent({ name: "Tuần sau" });
    const enrolled = await createStudent({
      name: "Đã đăng ký",
      status: "enrolled",
      lastActivityAt: new Date("2026-11-15T00:00:00Z"),
    });
    const fresh = await createStudent({
      name: "Mới nhắn",
      autoCreated: true,
      lastActivityAt: new Date("2026-11-16T02:00:00Z"),
    });
    await put(inWeek.id, "2026-11-18", "S3");
    await put(nextWeek.id, "2026-11-24", "S1");

    const res = await getWeek("2026-11-16");
    expect(res.status).toBe(200);
    expect(res.json.days).toHaveLength(6);
    expect(res.json.bookings).toEqual([
      expect.objectContaining({
        studentId: inWeek.id,
        date: "2026-11-18",
        slot: "S3",
        student: expect.objectContaining({ name: "Trong tuần" }),
      }),
    ]);
    expect(res.json.unscheduled.map((s: { id: string }) => s.id)).toEqual([fresh.id, enrolled.id]);
    // Học sinh có buổi ở tuần khác hiện riêng để kéo được sang tuần đang xem.
    expect(res.json.elsewhere).toEqual([
      expect.objectContaining({ studentId: nextWeek.id, date: "2026-11-24", slot: "S1" }),
    ]);
    const next = await getWeek("2026-11-23");
    expect(next.json.elsewhere.map((b: { studentId: string }) => b.studentId)).toEqual([inWeek.id]);

    const filtered = await getWeek("2026-11-16", "mới");
    expect(filtered.json.unscheduled.map((s: { id: string }) => s.id)).toEqual([fresh.id]);
  });

  it("week không phải thứ 2 trả 400", async () => {
    expect((await getWeek("2026-11-18")).status).toBe(400);
  });
});
