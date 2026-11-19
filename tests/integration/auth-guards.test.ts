import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { requireOwner, requireUser } from "@/server/auth/guards";
import { createSession } from "../helpers/session";

const req = (cookie?: string) =>
  new Request("http://localhost/api/x", { headers: cookie ? { cookie } : {} });

describe("requireUser / requireOwner", () => {
  it("không có phiên thì 401", async () => {
    await expect(requireUser(req())).rejects.toMatchObject({ status: 401 });
  });

  it("phiên không tồn tại thì 401", async () => {
    await expect(requireUser(req("authjs.session-token=khong-co"))).rejects.toMatchObject({
      status: 401,
    });
  });

  it("phiên hết hạn thì 401", async () => {
    const { sessionToken, cookie } = await createSession(prisma, { email: "nv@gmail.com" });
    await prisma.session.update({ where: { sessionToken }, data: { expires: new Date(0) } });
    await expect(requireUser(req(cookie))).rejects.toMatchObject({ status: 401 });
  });

  it("người dùng đã bị gỡ thì 401 ngay ở yêu cầu kế tiếp", async () => {
    const { user, cookie } = await createSession(prisma, { email: "nv@gmail.com" });
    expect((await requireUser(req(cookie))).id).toBe(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    await expect(requireUser(req(cookie))).rejects.toMatchObject({ status: 401 });
  });

  it("nhận cả cookie dạng __Secure- khi chạy HTTPS", async () => {
    const { user, sessionToken } = await createSession(prisma, { email: "nv@gmail.com" });
    const u = await requireUser(req(`__Secure-authjs.session-token=${sessionToken}`));
    expect(u.id).toBe(user.id);
  });

  it("nhân viên gọi requireOwner thì 403, chủ thì qua", async () => {
    const staff = await createSession(prisma, { email: "nv@gmail.com", role: "staff" });
    await expect(requireOwner(req(staff.cookie))).rejects.toMatchObject({ status: 403 });
    const owner = await createSession(prisma, { email: "owner@test.local", role: "owner" });
    expect((await requireOwner(req(owner.cookie))).role).toBe("owner");
  });
});
