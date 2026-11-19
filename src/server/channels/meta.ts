import { createHmac, timingSafeEqual } from "node:crypto";
import type { ConnectResult, Credentials, InboundMessage, SendErrorCode, SendResult } from "./types";

/**
 * Phần dùng chung cho Facebook Messenger và Instagram Messaging (nền tảng nhắn tin của Meta).
 * Định dạng dựa trên tài liệu Messenger Platform; xem research.md R1 (cần đối chiếu lại khi Meta
 * đổi phiên bản Graph API).
 */

export const GRAPH_VERSION = () => process.env.META_GRAPH_VERSION ?? "v23.0";
const GRAPH = () => `https://graph.facebook.com/${GRAPH_VERSION()}`;

export const humanAgentEnabled = () => process.env.META_HUMAN_AGENT === "true";
export const metaReplyWindowHours = () => (humanAgentEnabled() ? 168 : 24);

// ---------- Webhook ----------

export function verifyMetaSignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.META_APP_SECRET;
  const got = headers.get("x-hub-signature-256");
  if (!secret || !got?.startsWith("sha256=")) return false;
  const want = "sha256=" + createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export function metaChallenge(url: URL): string | null {
  const p = url.searchParams;
  const token = process.env.META_VERIFY_TOKEN;
  if (p.get("hub.mode") === "subscribe" && token && p.get("hub.verify_token") === token) {
    return p.get("hub.challenge");
  }
  return null;
}

type MetaAttachment = { type?: string; payload?: { url?: string } };
type MetaMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    attachments?: MetaAttachment[];
  };
};

/** Đọc thân webhook của Meta; chỉ lấy sự kiện tin nhắn (kể cả echo), bỏ đã xem/đã nhận/... */
export function parseMetaWebhook(rawBody: string, object: "page" | "instagram"): InboundMessage[] {
  const body = JSON.parse(rawBody) as { object?: string; entry?: { id?: string; messaging?: MetaMessaging[] }[] };
  if (body.object !== object) return [];
  const out: InboundMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const m = ev.message;
      if (!m?.mid || m.is_deleted) continue;
      const echo = !!m.is_echo;
      const threadId = echo ? ev.recipient?.id : ev.sender?.id;
      const accountId = entry.id ?? (echo ? ev.sender?.id : ev.recipient?.id);
      if (!threadId || !accountId) continue;
      const base = {
        externalAccountId: accountId,
        externalThreadId: threadId,
        direction: echo ? ("echo" as const) : ("inbound" as const),
        sentAt: new Date(ev.timestamp ?? Date.now()),
      };
      if (m.text) {
        out.push({ ...base, externalMessageId: m.mid, kind: "text", body: m.text });
        continue;
      }
      (m.attachments ?? []).forEach((a, i) => {
        const externalMessageId = i === 0 ? m.mid! : `${m.mid}:${i}`;
        if (a.type === "image" && a.payload?.url) {
          out.push({ ...base, externalMessageId, kind: "image", mediaRef: a.payload.url });
        } else {
          out.push({ ...base, externalMessageId, kind: "unsupported", unsupportedType: a.type ?? "attachment" });
        }
      });
    }
  }
  return out;
}

// ---------- Graph API ----------

type GraphError = { code?: number; error_subcode?: number; message?: string };

export class MetaApiError extends Error {
  constructor(public readonly error: GraphError) {
    super(error.message ?? "Lỗi Graph API");
  }
}

export async function graph<T>(
  path: string,
  opts: { method?: "GET" | "POST"; token?: string; query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${GRAPH()}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  if (opts.token) url.searchParams.set("access_token", opts.token);
  const res = await fetch(url.toString(), {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: GraphError } & T;
  if (!res.ok || data.error) throw new MetaApiError(data.error ?? { message: `HTTP ${res.status}` });
  return data;
}

export function mapMetaError(e: GraphError): SendErrorCode {
  const { code, error_subcode: sub } = e;
  if (code === 10 && sub === 2018278) return "window_expired";
  if (code === 100 && sub === 2018276) return "window_expired"; // HUMAN_AGENT chưa được duyệt
  if (code === 190 || code === 102) return "disconnected";
  if (code === 4 || code === 17 || code === 32 || code === 613) return "rate_limited";
  if (code === 551 || code === 100 || code === 200 || code === 230) return "rejected";
  return "unknown";
}

/**
 * Gửi văn bản (FR-007a): trong 24 giờ gửi RESPONSE; 24 giờ–7 ngày gửi thẻ HUMAN_AGENT nếu đã bật
 * META_HUMAN_AGENT; ngoài ra trả window_expired mà không gọi Meta.
 */
export async function metaSendText(
  credentials: Credentials,
  recipientId: string,
  text: string,
  lastInboundAt: Date | null,
  now: Date,
): Promise<SendResult> {
  const hours = lastInboundAt ? (now.getTime() - lastInboundAt.getTime()) / 3600_000 : Infinity;
  let envelope: Record<string, unknown>;
  if (hours <= 24) envelope = { messaging_type: "RESPONSE" };
  else if (hours <= 168 && humanAgentEnabled()) envelope = { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" };
  else return { ok: false, error: "window_expired" };

  try {
    const res = await graph<{ message_id: string }>(`/${credentials.pageId}/messages`, {
      method: "POST",
      token: credentials.pageToken,
      body: { recipient: { id: recipientId }, message: { text }, ...envelope },
    });
    return { ok: true, externalMessageId: res.message_id };
  } catch (e) {
    if (e instanceof MetaApiError) return { ok: false, error: mapMetaError(e.error), detail: e.message };
    return { ok: false, error: "unknown", detail: (e as Error).message };
  }
}

export async function metaFetchProfile(
  credentials: Credentials,
  userId: string,
  fields: string,
): Promise<{ name?: string; avatarRef?: string }> {
  const p = await graph<{ name?: string; username?: string; profile_pic?: string }>(`/${userId}`, {
    token: credentials.pageToken,
    query: { fields },
  });
  const name = p.name || p.username;
  return { ...(name ? { name } : {}), ...(p.profile_pic ? { avatarRef: p.profile_pic } : {}) };
}

export async function fetchUrlMedia(url: string): Promise<{ data: Buffer; contentType: string }> {
  if (!/^https:\/\//.test(url)) throw new Error("Địa chỉ ảnh không hợp lệ");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không tải được ảnh: HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error(`Không phải ảnh: ${contentType}`);
  return { data: Buffer.from(await res.arrayBuffer()), contentType };
}

// ---------- Kết nối (Facebook Login) ----------

export function metaLoginUrl(redirectUri: string, state: string, scopes: string[]): string {
  const u = new URL(`https://www.facebook.com/${GRAPH_VERSION()}/dialog/oauth`);
  u.searchParams.set("client_id", process.env.META_APP_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", scopes.join(","));
  return u.toString();
}

type PageAccount = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

/** Đổi mã cấp quyền lấy token dài hạn và danh sách Trang mà chủ quản lý. */
export async function metaPagesFromCode(params: URLSearchParams, redirectUri: string): Promise<PageAccount[]> {
  const code = params.get("code");
  if (!code) throw new Error(params.get("error_description") ?? "Chủ trung tâm chưa cấp quyền");
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    query: {
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      redirect_uri: redirectUri,
      code,
    },
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    query: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID ?? "",
      client_secret: process.env.META_APP_SECRET ?? "",
      fb_exchange_token: short.access_token,
    },
  });
  // Token Trang lấy từ token người dùng dài hạn không hết hạn.
  const pages = await graph<{ data: PageAccount[] }>("/me/accounts", {
    token: long.access_token,
    query: { fields: "id,name,access_token,instagram_business_account{id,username,name}" },
  });
  return pages.data;
}

/** Đăng ký nhận webhook tin nhắn và echo cho Trang. */
export async function subscribePage(page: PageAccount): Promise<void> {
  await graph(`/${page.id}/subscribed_apps`, {
    method: "POST",
    token: page.access_token,
    query: { subscribed_fields: "messages,message_echoes" },
  });
}

export function pageCredentials(page: PageAccount): Credentials {
  return { pageId: page.id, pageToken: page.access_token };
}

export type { PageAccount, ConnectResult };
