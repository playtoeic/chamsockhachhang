"use client";

import { useEvents } from "@/lib/use-events";

/** Khi chủ gỡ người đang dùng, đưa trình duyệt về trang đăng nhập ngay (FR-010). */
export function SessionWatcher() {
  useEvents({
    "session.revoked": () => {
      // Tải lại hẳn để xoá mọi dữ liệu đang hiện trên trình duyệt.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?error=revoked");
    },
  });
  return null;
}
