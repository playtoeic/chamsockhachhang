import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as step from "@/app/api/students/[id]/steps/[step]/route";
import * as one from "@/app/api/students/[id]/route";
import { autoTick } from "@/server/students/steps";
import { createStudent } from "../helpers/factory";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let me: Awaited<ReturnType<typeof createSession>>;
beforeEach(async () => {
  me = await createSession(prisma, { email: "lan@gmail.com", name: "Lan" });
});

const tick = (id: string, s: string, done: boolean) =>
  call(step.PUT, { method: "PUT", cookie: me.cookie, params: { id, step: s }, body: { done } });

describe("tick 5 bước (FR-025)", () => {
  it("tick ghi người tick và thời điểm; bỏ tick đưa về chưa xong", async () => {
    const s = await createStudent();
    expect((await tick(s.id, "tuition_paid", true)).status).toBe(200);
    let row = await prisma.stepProgress.findFirstOrThrow();
    expect(row).toMatchObject({ step: "tuition_paid", done: true, doneByUserId: me.user.id });
    expect(row.doneAt).toBeTruthy();

    await tick(s.id, "tuition_paid", false);
    row = await prisma.stepProgress.findFirstOrThrow();
    expect(row).toMatchObject({ done: false, doneByUserId: null, doneAt: null });
  });

  it("tick không theo thứ tự được phép", async () => {
    const s = await createStudent();
    expect((await tick(s.id, "commitment_signed", true)).status).toBe(200);
    expect((await tick(s.id, "entry_test", true)).status).toBe(200);
  });

  it("bước không thuộc 5 bước trả 400; học sinh không tồn tại trả 404", async () => {
    const s = await createStudent();
    expect((await tick(s.id, "an_trua", true)).status).toBe(400);
    expect((await tick("khong-co", "entry_test", true)).status).toBe(404);
  });

  it("chi tiết học sinh trả đủ 5 bước theo thứ tự, kể cả bước chưa có bản ghi", async () => {
    const s = await createStudent();
    await tick(s.id, "entry_test", true);
    const res = await call(one.GET, { cookie: me.cookie, params: { id: s.id } });
    expect(res.json.steps.map((x: { step: string; done: boolean }) => [x.step, x.done])).toEqual([
      ["trial_scheduled", false],
      ["class_scheduled", false],
      ["entry_test", true],
      ["tuition_paid", false],
      ["commitment_signed", false],
    ]);
    expect(res.json.steps[2].doneBy).toMatchObject({ name: "Lan" });
  });

  it("autoTick chỉ tick khi bước đang chưa xong, không ghi người tick", async () => {
    const s = await createStudent();
    await autoTick(prisma, s.id, "trial_scheduled");
    expect(await prisma.stepProgress.findFirstOrThrow()).toMatchObject({ done: true, doneByUserId: null });

    await tick(s.id, "class_scheduled", true);
    await autoTick(prisma, s.id, "class_scheduled");
    const manual = await prisma.stepProgress.findFirstOrThrow({ where: { step: "class_scheduled" } });
    expect(manual.doneByUserId).toBe(me.user.id);
  });
});
