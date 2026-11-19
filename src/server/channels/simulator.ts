import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { ChannelAdapter, InboundMessage, SendErrorCode } from "./types";

/**
 * Kênh giả lập cho dev và test (chỉ đăng ký khi ENABLE_SIMULATOR=true).
 * Định dạng webhook: { accountId, events: [{ type, threadId, messageId, customerName?, text?,
 * attachment?: { type, ref? }, sentAt }] } với type = message | echo | read | typing.
 */

export const SIMULATOR_ACCOUNT_ID = "sim-account";

type OutboxItem = { threadId: string; text: string; messageId: string; at: Date };

// 1x1 PNG trong suốt dùng làm ảnh giả lập.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

type State = {
  outbox: OutboxItem[];
  rejectWith: SendErrorCode | null;
  /** after = phát echo sau khi trả kết quả gửi; before = phát echo trước (mô phỏng tranh chấp). */
  echoMode: "after" | "before" | "off";
  profiles: Map<string, { name: string; avatar: boolean }>;
  failProfile: boolean;
  /** Đường giao echo về luồng tin đến; do src/server/inbox/receive.ts gắn vào. */
  deliver: ((rawBody: string) => Promise<void>) | null;
  pending: Set<Promise<void>>;
  reset(): void;
};

const g = globalThis as unknown as { __simulatorState?: State };

export const simulatorState: State = (g.__simulatorState ??= {
  outbox: [],
  rejectWith: null,
  echoMode: "after",
  profiles: new Map(),
  failProfile: false,
  deliver: null,
  pending: new Set(),
  reset() {
    this.outbox = [];
    this.rejectWith = null;
    this.echoMode = "after";
    this.profiles = new Map();
    this.failProfile = false;
    this.pending = new Set();
  },
});

const secret = () => process.env.SIMULATOR_SECRET ?? "dev-simulator-secret";

export function signSimulator(rawBody: string): string {
  return createHmac("sha256", secret()).update(rawBody).digest("hex");
}

export function simulatorPayload(events: Record<string, unknown>[]): string {
  return JSON.stringify({ accountId: SIMULATOR_ACCOUNT_ID, events });
}

/** Chờ mọi echo đang giao (dùng trong test). */
export async function flushSimulator(): Promise<void> {
  while (simulatorState.pending.size) await Promise.all([...simulatorState.pending]);
}

function deliverEcho(threadId: string, messageId: string, text: string): Promise<void> {
  const deliver = simulatorState.deliver;
  if (!deliver) return Promise.resolve();
  const raw = simulatorPayload([
    { type: "echo", threadId, messageId, text, sentAt: new Date().toISOString() },
  ]);
  const p = deliver(raw).finally(() => simulatorState.pending.delete(p));
  simulatorState.pending.add(p);
  return p;
}

type RawEvent = {
  type?: string;
  threadId?: string;
  messageId?: string;
  customerName?: string;
  text?: string;
  attachment?: { type?: string; ref?: string };
  sentAt?: string;
};

export const simulator: ChannelAdapter = {
  platform: "simulator",
  label: "Giả lập",

  replyWindowHours: () => 24,

  beginConnect(redirectUri, state) {
    const u = new URL(redirectUri);
    u.searchParams.set("code", "sim-code");
    u.searchParams.set("state", state);
    return u.toString();
  },

  async completeConnect(params) {
    if (params.get("code") !== "sim-code") throw new Error("Mã cấp quyền không hợp lệ");
    return {
      externalAccountId: SIMULATOR_ACCOUNT_ID,
      displayName: "Trang giả lập",
      credentials: { token: "sim-token" },
    };
  },

  verifyChallenge: () => null,

  verifyWebhook(headers, rawBody) {
    const got = headers.get("x-simulator-signature");
    if (!got) return false;
    const want = signSimulator(rawBody);
    return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  },

  parseWebhook(rawBody) {
    const parsed = JSON.parse(rawBody) as { accountId?: string; events?: RawEvent[] };
    const out: InboundMessage[] = [];
    for (const e of parsed.events ?? []) {
      if (e.type !== "message" && e.type !== "echo") continue;
      if (!e.threadId || !e.messageId) continue;
      const base = {
        externalAccountId: parsed.accountId ?? "",
        externalThreadId: e.threadId,
        externalMessageId: e.messageId,
        direction: e.type === "echo" ? ("echo" as const) : ("inbound" as const),
        ...(e.customerName ? { customerName: e.customerName } : {}),
        sentAt: e.sentAt ? new Date(e.sentAt) : new Date(),
      };
      if (e.attachment?.type === "image" && e.attachment.ref) {
        out.push({ ...base, kind: "image", mediaRef: e.attachment.ref });
      } else if (e.attachment?.type) {
        out.push({ ...base, kind: "unsupported", unsupportedType: e.attachment.type });
      } else {
        out.push({ ...base, kind: "text", body: e.text ?? "" });
      }
    }
    return out;
  },

  async sendText(_credentials, threadId, text) {
    if (simulatorState.rejectWith) return { ok: false, error: simulatorState.rejectWith };
    const messageId = `sim-out-${randomUUID()}`;
    simulatorState.outbox.push({ threadId, text, messageId, at: new Date() });
    if (simulatorState.echoMode === "before") await deliverEcho(threadId, messageId, text);
    if (simulatorState.echoMode === "after")
      setTimeout(() => void deliverEcho(threadId, messageId, text), 0);
    return { ok: true, externalMessageId: messageId };
  },

  async fetchMedia(_credentials, ref) {
    if (ref === "sim://fail") throw new Error("Không tải được ảnh");
    if (!ref.startsWith("sim://")) throw new Error("Tham chiếu ảnh không hợp lệ");
    return { data: PNG, contentType: "image/png" };
  },

  async fetchProfile(_credentials, threadId) {
    if (simulatorState.failProfile) throw new Error("Không lấy được hồ sơ");
    const p = simulatorState.profiles.get(threadId);
    if (!p) return {};
    return p.avatar ? { name: p.name, avatarRef: `sim://avatar/${threadId}` } : { name: p.name };
  },
};
