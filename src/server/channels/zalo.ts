import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { fetchUrlMedia } from "./meta";
import type { ChannelAdapter, Credentials, InboundMessage, SendErrorCode } from "./types";

/**
 * Zalo Official Account (research.md R1). Định dạng webhook, chữ ký và mã lỗi dựa trên tài liệu
 * Zalo OA API v3 và nguồn bên thứ ba; PHẢI kiểm chứng với developers.zalo.me khi OA được duyệt.
 */

const OAUTH = "https://oauth.zaloapp.com/v4/oa";
const OPENAPI = "https://openapi.zalo.me";
const MAX_TEXT = 2000;

const env = (k: string) => process.env[k] ?? "";
const windowHours = () => Number(process.env.ZALO_REPLY_WINDOW_HOURS ?? 48);

const b64url = (b: Buffer) =>
  b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** PKCE: code_verifier suy ra từ state bằng khoá bí mật, nên không phải lưu riêng. */
function codeVerifier(state: string): string {
  return b64url(
    createHmac("sha256", env("AUTH_SECRET") || "dev")
      .update(`zalo:${state}`)
      .digest(),
  );
}

type ZaloEvent = {
  app_id?: string;
  event_name?: string;
  timestamp?: string | number;
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: {
    msg_id?: string;
    text?: string;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
};

function mapZaloError(code: number): SendErrorCode {
  if (code === -216 || code === -124 || code === -14002) return "disconnected";
  if (code === -32 || code === -224) return "rate_limited";
  if (code === -213 || code === -201) return "window_expired";
  if (code === -230 || code === -217) return "rejected";
  return "unknown";
}

async function zaloGet<T>(
  path: string,
  token: string,
  query: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${OPENAPI}${path}`);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { access_token: token } });
  const data = (await res.json()) as { error?: number; message?: string } & T;
  if (data.error) throw new Error(`Zalo lỗi ${data.error}: ${data.message ?? ""}`);
  return data;
}

async function tokenRequest(form: Record<string, string>, now = new Date()): Promise<Credentials> {
  const res = await fetch(`${OAUTH}/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      secret_key: env("ZALO_APP_SECRET"),
    },
    body: new URLSearchParams({ app_id: env("ZALO_APP_ID"), ...form }).toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string | number;
    error?: number;
    error_name?: string;
  };
  if (!data.access_token)
    throw new Error(`Zalo không cấp token: ${data.error_name ?? data.error ?? res.status}`);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? form.refresh_token ?? "",
    expiresAt: new Date(now.getTime() + Number(data.expires_in ?? 90000) * 1000).toISOString(),
  };
}

export const zalo: ChannelAdapter = {
  platform: "zalo",
  label: "Zalo",
  replyWindowHours: windowHours,

  beginConnect(redirectUri, state) {
    const u = new URL(`${OAUTH}/permission`);
    u.searchParams.set("app_id", env("ZALO_APP_ID"));
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set(
      "code_challenge",
      b64url(createHash("sha256").update(codeVerifier(state)).digest()),
    );
    u.searchParams.set("state", state);
    return u.toString();
  },

  async completeConnect(params) {
    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) throw new Error("Chủ trung tâm chưa cấp quyền cho Zalo OA");
    const credentials = await tokenRequest({
      code,
      grant_type: "authorization_code",
      code_verifier: codeVerifier(state),
    });
    const oa = await zaloGet<{ data: { oa_id: string; name: string } }>(
      "/v2.0/oa/getoa",
      credentials.accessToken,
    );
    return { externalAccountId: String(oa.data.oa_id), displayName: oa.data.name, credentials };
  },

  // Zalo xác minh tên miền bằng tệp/thẻ meta, không gọi GET tới webhook.
  verifyChallenge: () => null,

  verifyWebhook(headers, rawBody) {
    const got = headers.get("x-zevent-signature");
    const secret = env("ZALO_OA_SECRET_KEY");
    if (!got || !secret) return false;
    let ts: string;
    try {
      ts = String((JSON.parse(rawBody) as ZaloEvent).timestamp ?? "");
    } catch {
      return false;
    }
    const want =
      "mac=" +
      createHash("sha256")
        .update(`${env("ZALO_APP_ID")}${rawBody}${ts}${secret}`)
        .digest("hex");
    return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  },

  parseWebhook(rawBody) {
    const e = JSON.parse(rawBody) as ZaloEvent;
    const name = e.event_name ?? "";
    const m = e.message;
    const fromUser = name.startsWith("user_send_");
    const fromOa = name.startsWith("oa_send_");
    if ((!fromUser && !fromOa) || !m?.msg_id) return [];
    const accountId = fromUser ? e.recipient?.id : e.sender?.id;
    const threadId = fromUser ? e.sender?.id : e.recipient?.id;
    if (!accountId || !threadId) return [];
    const base = {
      externalAccountId: accountId,
      externalThreadId: threadId,
      externalMessageId: m.msg_id,
      direction: fromUser ? ("inbound" as const) : ("echo" as const),
      sentAt: new Date(Number(e.timestamp ?? Date.now())),
    };
    const kind = name.replace(/^(user|oa)_send_/, "");
    const out: InboundMessage[] = [];
    if (kind === "text") out.push({ ...base, kind: "text", body: m.text ?? "" });
    else if (kind === "image" && m.attachments?.[0]?.payload?.url)
      out.push({ ...base, kind: "image", mediaRef: m.attachments[0].payload.url });
    else
      out.push({ ...base, kind: "unsupported", unsupportedType: m.attachments?.[0]?.type ?? kind });
    return out;
  },

  async sendText(credentials, userId, text, lastInboundAt, now) {
    if (text.length > MAX_TEXT)
      return { ok: false, error: "rejected", detail: "Tin Zalo tối đa 2000 ký tự" };
    if (!lastInboundAt || now.getTime() - lastInboundAt.getTime() > windowHours() * 3600_000) {
      return { ok: false, error: "window_expired" };
    }
    try {
      const res = await fetch(`${OPENAPI}/v3.0/oa/message/cs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", access_token: credentials.accessToken },
        body: JSON.stringify({ recipient: { user_id: userId }, message: { text } }),
      });
      const data = (await res.json()) as {
        error?: number;
        message?: string;
        data?: { message_id?: string };
      };
      if (data.error === 0 && data.data?.message_id)
        return { ok: true, externalMessageId: data.data.message_id };
      return { ok: false, error: mapZaloError(data.error ?? 0), detail: data.message };
    } catch (e) {
      return { ok: false, error: "unknown", detail: (e as Error).message };
    }
  },

  fetchMedia: (_c, ref) => fetchUrlMedia(ref),

  async fetchProfile(credentials, userId) {
    const r = await zaloGet<{ data: { display_name?: string; avatar?: string } }>(
      "/v3.0/oa/user/detail",
      credentials.accessToken,
      { data: JSON.stringify({ user_id: userId }) },
    );
    return {
      ...(r.data.display_name ? { name: r.data.display_name } : {}),
      ...(r.data.avatar ? { avatarRef: r.data.avatar } : {}),
    };
  },

  async refreshCredentials(credentials, now) {
    const expires = new Date(credentials.expiresAt ?? 0).getTime();
    if (expires - now.getTime() > 5 * 60_000) return null;
    return tokenRequest(
      { refresh_token: credentials.refreshToken, grant_type: "refresh_token" },
      now,
    );
  },
};
