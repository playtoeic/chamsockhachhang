import type { MessageKind, Platform } from "@prisma/client";

/** Thông tin truy cập kênh sau khi giải mã. Mỗi adapter tự định nghĩa các khoá. */
export type Credentials = Record<string, string>;

/** Sự kiện đến đã chuẩn hoá (contracts/channel-adapter.md). */
export type InboundMessage = {
  externalAccountId: string;
  externalThreadId: string;
  externalMessageId: string;
  /** inbound = khách gửi; echo = trung tâm gửi (từ website hoặc từ ứng dụng gốc). */
  direction: "inbound" | "echo";
  customerName?: string;
  kind: MessageKind;
  body?: string;
  mediaRef?: string;
  unsupportedType?: string;
  sentAt: Date;
};

export type SendErrorCode = "window_expired" | "disconnected" | "rate_limited" | "rejected" | "unknown";

export type SendResult =
  | { ok: true; externalMessageId: string }
  | { ok: false; error: SendErrorCode; detail?: string };

export const SEND_ERROR_MESSAGES: Record<SendErrorCode, string> = {
  window_expired: "Đã quá thời hạn trả lời trên kênh này",
  disconnected: "Kênh đang mất kết nối",
  rate_limited: "Kênh đang giới hạn số tin gửi, thử lại sau",
  rejected: "Kênh từ chối tin nhắn này",
  unknown: "Gửi thất bại, thử lại",
};

export type ConnectResult = {
  externalAccountId: string;
  displayName: string;
  credentials: Credentials;
};

export interface ChannelAdapter {
  platform: Platform;
  /** Tên hiển thị, cũng là nguồn ghi trên hồ sơ học sinh tự tạo. */
  label: string;
  /** Thời hạn trả lời sau tin cuối của khách, tính bằng giờ; null = không giới hạn. */
  replyWindowHours(): number | null;
  /** Địa chỉ trang cấp quyền của nền tảng. */
  beginConnect(redirectUri: string, state: string): string;
  completeConnect(params: URLSearchParams, redirectUri: string): Promise<ConnectResult>;
  /** Bước xác minh webhook bằng GET của nền tảng; null nếu yêu cầu không hợp lệ. */
  verifyChallenge(url: URL): string | null;
  verifyWebhook(headers: Headers, rawBody: string): boolean;
  parseWebhook(rawBody: string): InboundMessage[];
  sendText(
    credentials: Credentials,
    externalThreadId: string,
    text: string,
    lastInboundAt: Date | null,
    now: Date,
  ): Promise<SendResult>;
  fetchMedia(credentials: Credentials, ref: string): Promise<{ data: Buffer; contentType: string }>;
  fetchProfile(credentials: Credentials, externalThreadId: string): Promise<{ name?: string; avatarRef?: string }>;
  /**
   * Làm mới thông tin truy cập nếu sắp hết hạn (ví dụ access token Zalo ~25 giờ).
   * Trả null nếu chưa cần làm mới. Nơi gọi lưu lại kết quả.
   */
  refreshCredentials?(credentials: Credentials, now: Date): Promise<Credentials | null>;
}
