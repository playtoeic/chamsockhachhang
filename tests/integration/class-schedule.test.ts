import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as grid from "@/app/api/class-schedule/route";
import * as slotRoute from "@/app/api/students/[id]/class-slots/[weekday]/[slot]/route";
import { createStudent } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let cookie: string;
beforeEach(async () => {
  cookie = (await createSession(prisma, { email: "lan@gmail.com" })).cookie;
});

const put = (id: string, weekday: string, slot: string) =>
  call(slotRoute.PUT, { method: "PUT", cookie, params: { id, weekday, slot } });
const del = (id: string, weekday: string, slot: string) =>
  call(slotRoute.DELETE, { method: "DELETE", cookie, params: { id, weekday, slot } });

describe("xếp lịch học (FR-019, FR-020)", () => {
  it("PUT thêm khung; một học sinh có nhiều khung; khung đầu tiên tự tick 'xếp lịch học thật'", async () => {
    const s = await createStudent();
    expect((await put(s.id, "1", "S3")).status).toBe(200);
    expect((await put(s.id, "4", "S3")).status).toBe(200);
    expect((await put(s.id, "6", "S1")).status).toBe(200);
    expect(await prisma.classAssignment.count({ where: { studentId: s.id } })).toBe(3);
    const step = await prisma.stepProgress.findFirstOrThrow({
      where: { studentId: s.id, step: "class_scheduled" },
    });
    expect(step).toMatchObject({ done: true, doneByUserId: null });
  });

  it("PUT lặp lại cùng khung không tạo bản ghi thứ hai và không báo lỗi", async () => {
    const s = await createStudent();
    await put(s.id, "2", "S2");
    expect((await put(s.id, "2", "S2")).status).toBe(200);
    expect(await prisma.classAssignment.count()).toBe(1);
  });

  it("DELETE chỉ gỡ đúng một khung; không tự bỏ tick", async () => {
    const s = await createStudent();
    await put(s.id, "1", "S1");
    await put(s.id, "3", "S1");
    expect((await del(s.id, "1", "S1")).status).toBe(200);
    const left = await prisma.classAssignment.findMany({ where: { studentId: s.id } });
    expect(left.map((c) => [c.weekday, c.slot])).toEqual([[3, "S1"]]);
    await del(s.id, "3", "S1");
    expect(
      await prisma.stepProgress.count({
        where: { studentId: s.id, step: "class_scheduled", done: true },
      }),
    ).toBe(1);
  });

  it("weekday ngoài 1–6 hoặc slot sai trả 400; học sinh không tồn tại trả 404", async () => {
    const s = await createStudent();
    expect((await put(s.id, "7", "S1")).status).toBe(400);
    expect((await put(s.id, "0", "S1")).status).toBe(400);
    expect((await put(s.id, "1", "S5")).status).toBe(400);
    expect((await put("khong-co", "1", "S1")).status).toBe(404);
  });

  it("thao tác ở đây không thay đổi lịch học thử (FR-021)", async () => {
    const s = await createStudent();
    await prisma.trialBooking.create({
      data: { studentId: s.id, date: new Date("2026-11-18"), slot: "S3" },
    });
    await put(s.id, "3", "S3");
    await del(s.id, "3", "S3");
    const b = await prisma.trialBooking.findUniqueOrThrow({ where: { studentId: s.id } });
    expect([b.date.toISOString().slice(0, 10), b.slot]).toEqual(["2026-11-18", "S3"]);
  });
});

describe("GET /api/class-schedule", () => {
  it("trả toàn bộ lưới và danh sách chưa xếp gồm mọi học sinh chưa có khung nào, lọc được bằng q", async () => {
    const a = await createStudent({ name: "Đã xếp" });
    const b = await createStudent({
      name: "Chưa xếp cũ",
      lastActivityAt: new Date("2026-11-10T00:00:00Z"),
    });
    const c = await createStudent({
      name: "Chưa xếp mới",
      status: "trialed",
      lastActivityAt: new Date("2026-11-16T00:00:00Z"),
    });
    await put(a.id, "2", "S4");
    await put(a.id, "5", "S4");

    const res = await call(grid.GET, { cookie });
    expect(res.status).toBe(200);
    expect(
      res.json.assignments.map((x: { studentId: string; weekday: number; slot: string }) => [
        x.studentId,
        x.weekday,
        x.slot,
      ]),
    ).toEqual([
      [a.id, 2, "S4"],
      [a.id, 5, "S4"],
    ]);
    expect(res.json.assignments[0].student).toMatchObject({ name: "Đã xếp" });
    expect(res.json.unscheduled.map((s: { id: string }) => s.id)).toEqual([c.id, b.id]);

    const filtered = await call(grid.GET, {
      cookie,
      url: "http://localhost/api/class-schedule?q=c%C5%A9",
    });
    expect(filtered.json.unscheduled.map((s: { id: string }) => s.id)).toEqual([b.id]);
  });
});
