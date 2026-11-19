import { Inbox } from "@/components/inbox/Inbox";
import { listPlatforms } from "@/server/channels/registry";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return <Inbox platforms={listPlatforms().map((a) => a.platform)} />;
}
