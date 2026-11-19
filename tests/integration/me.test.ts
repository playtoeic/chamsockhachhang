import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { GET } from "@/app/api/me/route";
import { createSession } from "../helpers/session";

const ctx = { params: Promise.resolve({}) };

describe("GET /api/me", () => {
  it("trả đúng id, email, name, role của người đang đăng nhập", async () => {
    const { user, cookie } = await createSession(prisma, {
      email: "owner@test.local",
      role: "owner",
      name: "Chủ",
    });
    const res = await GET(new Request("http://localhost/api/me", { headers: { cookie } }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: user.id,
      email: "owner@test.local",
      name: "Chủ",
      role: "owner",
    });
  });

  it("không có phiên thì 401", async () => {
    const res = await GET(new Request("http://localhost/api/me"), ctx);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });
});
