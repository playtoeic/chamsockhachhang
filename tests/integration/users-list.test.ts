import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { GET } from "@/app/api/users/route";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

describe("GET /api/users", () => {
  it("chỉ trả người dùng đang hoạt động, đủ id, name, email, role", async () => {
    const me = await createSession(prisma, { email: "lan@gmail.com", name: "Lan" });
    await prisma.user.create({ data: { email: "cu@gmail.com", name: "Cũ", active: false } });
    await prisma.user.create({ data: { email: "owner@test.local", name: "Chủ", role: "owner" } });
    const res = await call(GET, { cookie: me.cookie });
    expect(res.status).toBe(200);
    const emails = res.json.items.map((u: { email: string }) => u.email).sort();
    expect(emails).toEqual(["lan@gmail.com", "owner@test.local"]);
    expect(Object.keys(res.json.items[0]).sort()).toEqual(["email", "id", "name", "role"]);
  });
});
