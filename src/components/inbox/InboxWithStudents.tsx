"use client";

import type { PlatformKey } from "@/lib/platforms";
import { Inbox } from "./Inbox";
import { StudentPanel } from "./StudentPanel";

/** Mục Tin nhắn kèm bảng hồ sơ học sinh bên phải (US3). */
export function InboxWithStudents({ platforms }: { platforms: PlatformKey[] }) {
  return (
    <Inbox platforms={platforms} sidePanel={(c) => <StudentPanel key={c.id} conversation={c} />} />
  );
}
