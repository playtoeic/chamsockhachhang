import type { PlatformKey } from "./platforms";

export type UserRef = { id: string; name: string | null; email: string };
export type StudentStatus = "considering" | "trialed" | "enrolled" | "dropped";

export type ConversationItem = {
  id: string;
  platform: PlatformKey;
  channelName: string;
  customerName: string;
  avatarUrl: string | null;
  unread: boolean;
  lastMessageAt: string;
  replyWindowExpiresAt: string | null;
  assignee: UserRef | null;
  student: { id: string; name: string; status: StudentStatus } | null;
  lastMessage: { direction: "inbound" | "outbound"; kind: string; body: string | null; unsupportedType: string | null } | null;
};

export type MessageItem = {
  id: string;
  direction: "inbound" | "outbound";
  kind: "text" | "image" | "unsupported";
  body: string | null;
  mediaUrl: string | null;
  unsupportedType: string | null;
  status: "received" | "sending" | "sent" | "failed";
  failureReason: string | null;
  createdAt: string;
  sentBy: UserRef | null;
  fromNativeApp: boolean;
};

export type ActiveUser = { id: string; name: string | null; email: string; role: "owner" | "staff" };
