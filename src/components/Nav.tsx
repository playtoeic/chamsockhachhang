"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "./UserContext";

const ITEMS = [
  { href: "/inbox", label: "Tin nhắn" },
  { href: "/class-schedule", label: "Lịch: xếp lịch học" },
  { href: "/trial-schedule", label: "Lịch: học thử" },
  { href: "/steps", label: "Các bước" },
];

export function Nav({ logout }: { logout: () => Promise<void> }) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const items =
    user.role === "owner" ? [...ITEMS, { href: "/settings/staff", label: "Cài đặt" }] : ITEMS;
  const isActive = (href: string) =>
    href.startsWith("/settings") ? pathname.startsWith("/settings") : pathname.startsWith(href);

  return (
    <nav className="topbar" aria-label="Mục chính">
      <span className="brand">Hộp thư trung tâm</span>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`nav${isActive(item.href) ? " active" : ""}`}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
      <span className="spacer" />
      <span className="who">{user.name ?? user.email}</span>
      <form action={logout}>
        <button type="submit">Đăng xuất</button>
      </form>
    </nav>
  );
}
