import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/current";

export const dynamic = "force-dynamic";

/** Khu vực chỉ dành cho chủ (FR-011): nhân viên bị chuyển về Tin nhắn. */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") redirect("/inbox");
  return (
    <div className="settings">
      <nav className="tabs" aria-label="Cài đặt">
        <Link href="/settings/staff">Nhân viên</Link>
        <Link href="/settings/channels">Kênh</Link>
      </nav>
      {children}
    </div>
  );
}
