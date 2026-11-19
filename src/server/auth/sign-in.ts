import { prisma } from "@/server/db";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Quy tắc đăng nhập (FR-009): chỉ chủ (OWNER_EMAIL) và email đã được chủ thêm, còn hoạt động.
 * Chủ được tự tạo ở lần đăng nhập đầu.
 */
export async function canSignIn(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const e = normalizeEmail(email);
  const owner = process.env.OWNER_EMAIL ? normalizeEmail(process.env.OWNER_EMAIL) : null;
  if (owner && e === owner) {
    await prisma.user.upsert({
      where: { email: e },
      create: { email: e, role: "owner", active: true },
      update: { role: "owner", active: true },
    });
    return true;
  }
  const user = await prisma.user.findUnique({ where: { email: e } });
  return !!user?.active;
}
