import { randomBytes } from "node:crypto";
import type { PrismaClient, Role } from "@prisma/client";

export const SESSION_COOKIE = "authjs.session-token";

/**
 * Tạo người dùng và phiên đăng nhập trực tiếp trong cơ sở dữ liệu (không gọi Google).
 * Dùng được cho integration test và Playwright.
 */
export async function createSession(
  prisma: PrismaClient,
  opts: { email: string; role?: Role; name?: string; active?: boolean },
) {
  const email = opts.email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      role: opts.role ?? "staff",
      name: opts.name ?? email.split("@")[0],
      active: opts.active ?? true,
    },
    update: {},
  });
  const sessionToken = randomBytes(24).toString("hex");
  await prisma.session.create({
    data: { sessionToken, userId: user.id, expires: new Date(Date.now() + 24 * 3600 * 1000) },
  });
  return { user, sessionToken, cookie: `${SESSION_COOKIE}=${sessionToken}` };
}
