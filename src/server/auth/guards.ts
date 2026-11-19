import type { User } from "@prisma/client";
import { prisma } from "@/server/db";
import { forbidden, unauthorized } from "@/server/http";
import { clock } from "@/lib/clock";

const COOKIE_NAMES = ["__Secure-authjs.session-token", "authjs.session-token"];

export type CurrentUser = Pick<User, "id" | "email" | "name" | "role">;

export function readSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((p) => p.trim());
  for (const name of COOKIE_NAMES) {
    const hit = pairs.find((p) => p.startsWith(`${name}=`));
    if (hit) return decodeURIComponent(hit.slice(name.length + 1));
  }
  return null;
}

/** Tra phiên trong cơ sở dữ liệu; trả người dùng nếu phiên còn hạn và người dùng còn hoạt động. */
export async function userFromSessionToken(token: string | null): Promise<CurrentUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: { select: { id: true, email: true, name: true, role: true, active: true } } },
  });
  if (!session || session.expires <= clock.now() || !session.user.active) return null;
  const { id, email, name, role } = session.user;
  return { id, email, name, role };
}

/** Yêu cầu phiên của người dùng đang hoạt động; kiểm tra lại trên mỗi yêu cầu (FR-010). */
export async function requireUser(req: Request): Promise<CurrentUser> {
  const user = await userFromSessionToken(readSessionToken(req.headers.get("cookie")));
  if (!user) throw unauthorized();
  return user;
}

export async function requireOwner(req: Request): Promise<CurrentUser> {
  const user = await requireUser(req);
  if (user.role !== "owner") throw forbidden();
  return user;
}
