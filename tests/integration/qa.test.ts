import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import * as list from "@/app/api/qa/route";
import * as one from "@/app/api/qa/[id]/route";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let owner: Awaited<ReturnType<typeof createSession>>;
let staff: Awaited<ReturnType<typeof createSession>>;

beforeEach(async () => {
  owner = await createSession(prisma, { email: "owner@test.local", role: "owner" });
  staff = await createSession(prisma, { email: "lan@gmail.com" });
});

const create = (cookie: string, body: unknown) => call(list.POST, { method: "POST", cookie, body });

describe("Q&A (FR-028)", () => {
  it("chủ thêm, sửa, xoá; ghi người sửa cuối", async () => {
    const c = await create(owner.cookie, {
      question: "Học phí bao nhiêu?",
      answer: "2 triệu/tháng",
    });
    expect(c.status).toBe(201);
    expect(c.json).toMatchObject({ question: "Học phí bao nhiêu?", answer: "2 triệu/tháng" });
    const id = c.json.id;
    const u = await call(one.PATCH, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { id },
      body: { answer: "2,5 triệu/tháng" },
    });
    expect(u.status).toBe(200);
    expect(u.json.answer).toBe("2,5 triệu/tháng");
    expect((await prisma.qaEntry.findUniqueOrThrow({ where: { id } })).updatedByUserId).toBe(
      owner.user.id,
    );
    expect(
      (await call(one.DELETE, { method: "DELETE", cookie: owner.cookie, params: { id } })).status,
    ).toBe(200);
    expect(await prisma.qaEntry.count()).toBe(0);
  });

  it("question hoặc answer trống trả 400", async () => {
    expect((await create(owner.cookie, { question: " ", answer: "a" })).status).toBe(400);
    expect((await create(owner.cookie, { question: "q", answer: "" })).status).toBe(400);
  });

  it("nhân viên GET được nhưng POST, PATCH, DELETE nhận 403", async () => {
    const e = await prisma.qaEntry.create({ data: { question: "q", answer: "a" } });
    expect((await call(list.GET, { cookie: staff.cookie })).status).toBe(200);
    expect((await create(staff.cookie, { question: "q", answer: "a" })).status).toBe(403);
    expect(
      (
        await call(one.PATCH, {
          method: "PATCH",
          cookie: staff.cookie,
          params: { id: e.id },
          body: { answer: "b" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(one.DELETE, { method: "DELETE", cookie: staff.cookie, params: { id: e.id } }))
        .status,
    ).toBe(403);
  });

  it("q khớp cả câu hỏi lẫn câu trả lời, không phân biệt hoa thường", async () => {
    const a = await prisma.qaEntry.create({
      data: { question: "Học phí bao nhiêu?", answer: "2 triệu" },
    });
    const b = await prisma.qaEntry.create({
      data: { question: "Lịch học?", answer: "Tối thứ 3 và thứ 5, có HỌC PHÍ ưu đãi" },
    });
    await prisma.qaEntry.create({ data: { question: "Địa chỉ?", answer: "Quận 1" } });
    const res = await call(list.GET, {
      cookie: staff.cookie,
      url: "http://localhost/api/qa?q=h%E1%BB%8Dc%20ph%C3%AD",
    });
    expect(res.json.items.map((x: { id: string }) => x.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("sửa hoặc xoá mục không tồn tại trả 404", async () => {
    expect(
      (
        await call(one.PATCH, {
          method: "PATCH",
          cookie: owner.cookie,
          params: { id: "x" },
          body: { answer: "b" },
        })
      ).status,
    ).toBe(404);
    expect(
      (await call(one.DELETE, { method: "DELETE", cookie: owner.cookie, params: { id: "x" } }))
        .status,
    ).toBe(404);
  });
});
