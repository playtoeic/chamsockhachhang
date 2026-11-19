import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/server/db";
import { canSignIn, normalizeEmail } from "./sign-in";

/**
 * Auth.js: đăng nhập Google, phiên lưu trong cơ sở dữ liệu để gỡ nhân viên có hiệu lực ngay
 * (research.md R4). Kiểm tra quyền ở từng yêu cầu nằm trong ./guards.ts.
 */
export const { handlers, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  trustHost: true,
  providers: [
    Google({
      // Google đã xác minh email; nhân viên được chủ thêm trước nên cần liên kết theo email.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, profile }) {
      const email = profile?.email ?? user.email;
      if (!(await canSignIn(email))) return false;
      const name = profile?.name ?? user.name;
      if (email && name) {
        await prisma.user.updateMany({
          where: { email: normalizeEmail(email), name: null },
          data: { name },
        });
      }
      return true;
    },
  },
});
