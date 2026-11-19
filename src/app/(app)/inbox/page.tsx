import { InboxWithStudents } from "@/components/inbox/InboxWithStudents";
import { listPlatforms } from "@/server/channels/registry";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return <InboxWithStudents platforms={listPlatforms().map((a) => a.platform)} />;
}
