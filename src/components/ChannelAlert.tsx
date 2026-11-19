"use client";

import Link from "next/link";
import { useData } from "@/lib/use-data";
import { useEvents } from "@/lib/use-events";
import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { useCurrentUser } from "./UserContext";

type Conn = { id: string; platform: PlatformKey; displayName: string; status: string };

/** Cảnh báo kênh mất kết nối, hiện ở mọi trang (FR-008). */
export function ChannelAlert() {
  const user = useCurrentUser();
  const { data, reload } = useData<{ items: Conn[] }>("/api/channels");
  useEvents({ "channel.updated": reload }, reload);

  const down = data?.items.filter((c) => c.status === "disconnected") ?? [];
  if (down.length === 0) return null;
  return (
    <div className="alert" role="alert">
      Kênh đang mất kết nối:{" "}
      {down.map((c) => `${PLATFORMS[c.platform].label} (${c.displayName})`).join(", ")}.{" "}
      {user.role === "owner" ? (
        <Link href="/settings/channels">Kết nối lại</Link>
      ) : (
        "Báo chủ trung tâm để kết nối lại."
      )}
    </div>
  );
}
