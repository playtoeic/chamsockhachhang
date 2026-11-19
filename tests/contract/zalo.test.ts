import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { zalo } from "@/server/channels/zalo";

/**
 * Bảo đảm hành vi 1–7 cho Zalo OA. Dữ liệu mẫu tự tạo theo định dạng webhook của Zalo OA;
 * định dạng chữ ký và thời hạn trả lời cần kiểm chứng lại với developers.zalo.me (research.md R1).
 */
const fixture = (name: string) => readFileSync(path.resolve("tests/fixtures/zalo", `${name}.json`), "utf8");
const sign = (raw: string) => {
  const ts = JSON.parse(raw).timestamp;
  return "mac=" + createHash("sha256").update(`zalo-app-1${raw}${ts}oa-secret`).digest("hex");
};

const creds = { accessToken: "AT", refreshToken: "RT", expiresAt: "2026-11-21T00:00:00Z" };
const now = new Date("2026-11-20T00:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

beforeEach(() => {
  process.env.ZALO_APP_ID = "zalo-app-1";
  process.env.ZALO_APP_SECRET = "app-secret";
  process.env.ZALO_OA_SECRET_KEY = "oa-secret";
  delete process.env.ZALO_REPLY_WINDOW_HOURS;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("zalo: bảo đảm hành vi", () => {
  it("1. verifyWebhook từ chối chữ ký sai hoặc thiếu, nhận chữ ký đúng", () => {
    const raw = fixture("text");
    expect(zalo.verifyWebhook(new Headers(), raw)).toBe(false);
    expect(zalo.verifyWebhook(new Headers({ "x-zevent-signature": "mac=abc" }), raw)).toBe(false);
    expect(zalo.verifyWebhook(new Headers({ "x-zevent-signature": sign(raw) }), raw)).toBe(true);
    expect(zalo.verifyWebhook(new Headers({ "x-zevent-signature": sign(raw) }), raw.replace("hỏi", "hoi"))).toBe(false);
  });

  it("2. tin văn bản trả đúng một InboundMessage có đủ trường", () => {
    expect(zalo.parseWebhook(fixture("text"))).toEqual([
      {
        externalAccountId: "oa-555",
        externalThreadId: "zalo-user-44",
        externalMessageId: "zmsg_text_1",
        direction: "inbound",
        kind: "text",
        body: "Cho em hỏi lịch học",
        sentAt: new Date(1763262000000),
      },
    ]);
  });

  it("3. tin ảnh trả kind = image; sticker trả unsupported", () => {
    expect(zalo.parseWebhook(fixture("image"))[0]).toMatchObject({
      kind: "image",
      mediaRef: "https://cdn.example.test/z.jpg",
    });
    expect(zalo.parseWebhook(fixture("sticker"))[0]).toMatchObject({ kind: "unsupported", unsupportedType: "sticker" });
  });

  it("4. sự kiện không phải tin nhắn (đã xem) trả danh sách trống", () => {
    expect(zalo.parseWebhook(fixture("seen"))).toEqual([]);
  });

  it("5. sendText ánh xạ lỗi Zalo sang mã chuẩn hoá; văn bản quá 2000 ký tự bị từ chối", async () => {
    const cases: [number, string][] = [
      [-216, "disconnected"],
      [-124, "disconnected"],
      [-32, "rate_limited"],
      [-213, "window_expired"],
      [-999, "unknown"],
    ];
    for (const [code, want] of cases) {
      reply({ error: code, message: "lỗi" });
      expect(await zalo.sendText(creds, "zalo-user-44", "chào", hoursAgo(1), now), String(code)).toMatchObject({
        ok: false,
        error: want,
      });
    }
    fetchMock.mockClear();
    expect(await zalo.sendText(creds, "zalo-user-44", "a".repeat(2001), hoursAgo(1), now)).toMatchObject({
      ok: false,
      error: "rejected",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    reply({ error: 0, message: "Success", data: { message_id: "zout_1", user_id: "zalo-user-44" } });
    expect(await zalo.sendText(creds, "zalo-user-44", "chào", hoursAgo(1), now)).toEqual({
      ok: true,
      externalMessageId: "zout_1",
    });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://openapi.zalo.me/v3.0/oa/message/cs");
    expect((init as RequestInit).headers).toMatchObject({ access_token: "AT" });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      recipient: { user_id: "zalo-user-44" },
      message: { text: "chào" },
    });
  });

  it("thời hạn trả lời mặc định 48 giờ, cấu hình được; quá hạn thì không gọi Zalo", async () => {
    expect(zalo.replyWindowHours()).toBe(48);
    expect(await zalo.sendText(creds, "zalo-user-44", "chào", hoursAgo(49), now)).toMatchObject({
      ok: false,
      error: "window_expired",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.ZALO_REPLY_WINDOW_HOURS = "168";
    expect(zalo.replyWindowHours()).toBe(168);
  });

  it("6. sự kiện OA gửi tin trả direction = echo, cuộc trò chuyện theo người nhận", () => {
    expect(zalo.parseWebhook(fixture("echo"))).toEqual([
      expect.objectContaining({
        direction: "echo",
        externalAccountId: "oa-555",
        externalThreadId: "zalo-user-44",
        externalMessageId: "zmsg_echo_1",
        body: "Trả lời trong ứng dụng",
      }),
    ]);
  });

  it("7. fetchProfile trả tên và ảnh khi có, không có ảnh khi Zalo không trả", async () => {
    reply({ error: 0, data: { user_id: "zalo-user-44", display_name: "Trần Bình", avatar: "https://cdn.example.test/a.jpg" } });
    expect(await zalo.fetchProfile(creds, "zalo-user-44")).toEqual({
      name: "Trần Bình",
      avatarRef: "https://cdn.example.test/a.jpg",
    });
    reply({ error: 0, data: { user_id: "zalo-user-44", display_name: "Khách" } });
    expect(await zalo.fetchProfile(creds, "zalo-user-44")).toEqual({ name: "Khách" });
  });

  it("làm mới access token khi sắp hết hạn", async () => {
    expect(await zalo.refreshCredentials!(creds, now)).toBeNull();
    reply({ access_token: "AT2", refresh_token: "RT2", expires_in: "90000" });
    const fresh = await zalo.refreshCredentials!({ ...creds, expiresAt: "2026-11-20T00:00:30Z" }, now);
    expect(fresh).toEqual({ accessToken: "AT2", refreshToken: "RT2", expiresAt: "2026-11-21T01:00:00.000Z" });
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://oauth.zaloapp.com/v4/oa/access_token");
    expect((init as RequestInit).headers).toMatchObject({ secret_key: "app-secret" });
    expect(String((init as RequestInit).body)).toContain("grant_type=refresh_token");
  });
});
