import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { setTestNow } from "@/lib/clock";
import { runAutoMark } from "@/server/schedule/auto-mark";
import { setTrial } from "@/server/schedule/trial";
import { updateStudent } from "@/server/students/students";
import { createStudent } from "../helpers/factory";

// Buổi thứ 3, 17/11/2026, khung S3 (18–20 giờ Việt Nam) kết thúc lúc 13:00 UTC.
const END = new Date("2026-11-17T13:00:00Z");
const before = new Date(END.getTime() - 60_000);
const after = new Date(END.getTime() + 60_000);

beforeEach(() => setTestNow(new Date("2026-11-16T03:00:00Z")));
afterEach(() => setTestNow(null));

async function book(status: "considering" | "trialed" | "enrolled" | "dropped" = "considering") {
  const s = await createStudent({ status });
  await setTrial(s.id, "2026-11-17", "S3");
  return s;
}
const reload = (id: string) => prisma.student.findUniqueOrThrow({ where: { id } });

describe("tự chuyển 'đã học thử' (FR-014)", () => {
  it("trước giờ kết thúc không đổi", async () => {
    const s = await book();
    await runAutoMark(before);
    expect((await reload(s.id)).status).toBe("considering");
    expect((await prisma.trialBooking.findFirstOrThrow()).autoMarkedAt).toBeNull();
  });

  it("sau giờ kết thúc: considering → trialed với statusSource = auto và ghi autoMarkedAt", async () => {
    const s = await book();
    await runAutoMark(after);
    expect(await reload(s.id)).toMatchObject({ status: "trialed", statusSource: "auto" });
    expect((await prisma.trialBooking.findFirstOrThrow()).autoMarkedAt?.toISOString()).toBe(
      after.toISOString(),
    );
  });

  it("học sinh 'đã đăng ký' hoặc 'ngừng theo' không bị đổi nhưng buổi vẫn được ghi autoMarkedAt", async () => {
    const e = await book("enrolled");
    const d = await createStudent({ status: "dropped" });
    await setTrial(d.id, "2026-11-17", "S3");
    await runAutoMark(after);
    expect((await reload(e.id)).status).toBe("enrolled");
    expect((await reload(d.id)).status).toBe("dropped");
    expect(await prisma.trialBooking.count({ where: { autoMarkedAt: null } })).toBe(0);
  });

  it("chuyển tay về 'đang tham khảo' rồi chạy lại thì giữ nguyên (FR-014a)", async () => {
    const s = await book();
    await runAutoMark(after);
    await updateStudent(s.id, { status: "considering" });
    await runAutoMark(new Date(after.getTime() + 3600_000));
    expect(await reload(s.id)).toMatchObject({ status: "considering", statusSource: "manual" });
  });

  it("vắng rồi xếp lại buổi mới trong tương lai: buổi mới trôi qua thì tự chuyển lại", async () => {
    const s = await book();
    await runAutoMark(after);
    await updateStudent(s.id, { status: "considering" });
    setTestNow(after);
    await setTrial(s.id, "2026-11-19", "S1"); // kết thúc 04:00 UTC ngày 19
    await runAutoMark(new Date("2026-11-19T04:01:00Z"));
    expect((await reload(s.id)).status).toBe("trialed");
  });

  it("'đã học thử' tự động xếp lại sang tương lai thì về 'đang tham khảo'; nguồn tay thì giữ (FR-014b)", async () => {
    const a = await book();
    await runAutoMark(after);
    setTestNow(after);
    await setTrial(a.id, "2026-11-20", "S2");
    expect(await reload(a.id)).toMatchObject({ status: "considering", statusSource: "auto" });

    const m = await createStudent({ status: "trialed" });
    await setTrial(m.id, "2026-11-20", "S2");
    expect((await reload(m.id)).status).toBe("trialed");
  });

  it("chạy nhiều lần chỉ xử lý mỗi buổi một lần", async () => {
    const s = await book();
    await runAutoMark(after);
    const first = (await prisma.trialBooking.findFirstOrThrow()).autoMarkedAt;
    await runAutoMark(new Date(after.getTime() + 120_000));
    expect((await prisma.trialBooking.findFirstOrThrow()).autoMarkedAt?.toISOString()).toBe(
      first?.toISOString(),
    );
    expect((await reload(s.id)).status).toBe("trialed");
  });
});
