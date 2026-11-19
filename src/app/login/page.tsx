import { redirect } from "next/navigation";
import { signIn } from "@/server/auth/config";
import { getCurrentUser } from "@/server/auth/current";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  AccessDenied: "Tài khoản Google này chưa được chủ trung tâm cấp quyền.",
  revoked: "Quyền truy cập của bạn đã bị gỡ.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/inbox");
  const { error } = await searchParams;
  const message = error ? (MESSAGES[error] ?? "Đăng nhập không thành công, vui lòng thử lại.") : null;

  return (
    <main className="login panel">
      <h1>Hộp thư trung tâm</h1>
      <p className="muted">Đăng nhập bằng tài khoản Google đã được chủ trung tâm thêm.</p>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/inbox" });
        }}
      >
        <button className="primary" type="submit">
          Đăng nhập bằng Google
        </button>
      </form>
    </main>
  );
}
