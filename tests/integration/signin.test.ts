import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { canSignIn } from "@/server/auth/sign-in";

describe("canSignIn (FR-009)", () => {
  it("email đã được thêm và còn hoạt động thì được vào", async () => {
    await prisma.user.create({ data: { email: "nv@gmail.com", role: "staff" } });
    expect(await canSignIn("nv@gmail.com")).toBe(true);
  });

  it("email chưa được thêm thì bị từ chối và không tạo người dùng", async () => {
    expect(await canSignIn("la@gmail.com")).toBe(false);
    expect(await prisma.user.count()).toBe(0);
  });

  it("email đã bị gỡ (active = false) thì bị từ chối", async () => {
    await prisma.user.create({ data: { email: "cu@gmail.com", role: "staff", active: false } });
    expect(await canSignIn("cu@gmail.com")).toBe(false);
  });

  it("so khớp không phân biệt hoa thường", async () => {
    await prisma.user.create({ data: { email: "nv@gmail.com", role: "staff" } });
    expect(await canSignIn("NV@Gmail.com")).toBe(true);
  });

  it("OWNER_EMAIL đăng nhập lần đầu thì được tạo với vai trò chủ", async () => {
    expect(await canSignIn("Owner@Test.local")).toBe(true);
    const owner = await prisma.user.findUnique({ where: { email: "owner@test.local" } });
    expect(owner).toMatchObject({ role: "owner", active: true });
    expect(await canSignIn("owner@test.local")).toBe(true);
    expect(await prisma.user.count()).toBe(1);
  });

  it("email trống bị từ chối", async () => {
    expect(await canSignIn(undefined)).toBe(false);
    expect(await canSignIn("")).toBe(false);
  });
});
