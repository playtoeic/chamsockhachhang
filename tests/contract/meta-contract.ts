import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelAdapter } from "@/server/channels/types";

/**
 * Bảo đảm hành vi 1–8 (contracts/channel-adapter.md) dùng chung cho Facebook và Instagram.
 * Dữ liệu mẫu trong tests/fixtures/<platform>/ là dữ liệu tự tạo theo định dạng của Meta.
 */
export function metaContract(
  adapter: ChannelAdapter,
  opts: { fixtures: string; accountId: string; userId: string; profileFields: string },
) {
  const fixture = (name: string) => readFileSync(path.resolve("tests/fixtures", opts.fixtures, `${name}.json`), "utf8");
  const sign = (raw: string) => "sha256=" + createHmac("sha256", "test-app-secret").update(raw).digest("hex");
  const creds = { pageId: "1111111111", pageToken: "PAGE_TOKEN" };
  const now = new Date("2026-11-20T00:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  let fetchMock: ReturnType<typeof vi.fn>;
  const reply = (status: number, body: unknown) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

  beforeEach(() => {
    process.env.META_APP_SECRET = "test-app-secret";
    process.env.META_VERIFY_TOKEN = "verify-me";
    process.env.META_HUMAN_AGENT = "false";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  describe(`${adapter.platform}: bảo đảm hành vi`, () => {
    it("1. verifyWebhook từ chối chữ ký sai hoặc thiếu, nhận chữ ký X-Hub-Signature-256 đúng", () => {
      const raw = fixture("text");
      expect(adapter.verifyWebhook(new Headers(), raw)).toBe(false);
      expect(adapter.verifyWebhook(new Headers({ "x-hub-signature-256": "sha256=deadbeef" }), raw)).toBe(false);
      expect(adapter.verifyWebhook(new Headers({ "x-hub-signature-256": sign(raw) }), raw)).toBe(true);
      expect(adapter.verifyWebhook(new Headers({ "x-hub-signature-256": sign(raw) }), raw + " ")).toBe(false);
    });

    it("bước xác minh webhook trả hub.challenge khi verify_token đúng", () => {
      const ok = new URL("https://x.test/api/webhooks/x?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42");
      const bad = new URL("https://x.test/api/webhooks/x?hub.mode=subscribe&hub.verify_token=sai&hub.challenge=42");
      expect(adapter.verifyChallenge(ok)).toBe("42");
      expect(adapter.verifyChallenge(bad)).toBeNull();
    });

    it("2. tin văn bản trả đúng một InboundMessage có đủ trường", () => {
      expect(adapter.parseWebhook(fixture("text"))).toEqual([
        {
          externalAccountId: opts.accountId,
          externalThreadId: opts.userId,
          externalMessageId: "m_text_1",
          direction: "inbound",
          kind: "text",
          body: "Cho em hỏi lịch học",
          sentAt: new Date(1763262000000),
        },
      ]);
    });

    it("3. tin ảnh trả kind = image; loại khác trả unsupported kèm tên loại", () => {
      const out = adapter.parseWebhook(fixture("attachments"));
      expect(out[0]).toMatchObject({ kind: "image", mediaRef: "https://cdn.example.test/img1.jpg", externalMessageId: "m_img_1" });
      expect(out[1]).toMatchObject({ kind: "unsupported", unsupportedType: "video", externalMessageId: "m_vid_1" });
    });

    it("4. sự kiện không phải tin nhắn (đã xem, đã nhận) trả danh sách trống", () => {
      expect(adapter.parseWebhook(fixture("non-message"))).toEqual([]);
    });

    it("thân webhook của object khác bị bỏ qua", () => {
      expect(adapter.parseWebhook(JSON.stringify({ object: "whatsapp_business_account", entry: [] }))).toEqual([]);
    });

    it("5. sendText ánh xạ mỗi lỗi của Meta sang đúng một mã chuẩn hoá", async () => {
      const cases: [unknown, string][] = [
        [{ error: { code: 10, error_subcode: 2018278, message: "outside window" } }, "window_expired"],
        [{ error: { code: 190, message: "token expired" } }, "disconnected"],
        [{ error: { code: 613, message: "rate" } }, "rate_limited"],
        [{ error: { code: 551, message: "user unavailable" } }, "rejected"],
        [{ error: { code: 1, message: "unknown" } }, "unknown"],
      ];
      for (const [body, code] of cases) {
        reply(400, body);
        const r = await adapter.sendText(creds, opts.userId, "chào", hoursAgo(1), now);
        expect(r, code).toMatchObject({ ok: false, error: code });
      }
      reply(200, { recipient_id: opts.userId, message_id: "m_out_9" });
      expect(await adapter.sendText(creds, opts.userId, "chào", hoursAgo(1), now)).toEqual({
        ok: true,
        externalMessageId: "m_out_9",
      });
    });

    it("6. sự kiện is_echo trả direction = echo, cuộc trò chuyện theo người nhận", () => {
      expect(adapter.parseWebhook(fixture("echo"))).toEqual([
        expect.objectContaining({
          direction: "echo",
          externalAccountId: opts.accountId,
          externalThreadId: opts.userId,
          externalMessageId: "m_echo_1",
          body: "Trả lời trong ứng dụng",
        }),
      ]);
    });

    it("7. fetchProfile trả tên và ảnh khi có, không có ảnh khi Meta không trả", async () => {
      reply(200, { name: "Nguyễn Văn An", profile_pic: "https://cdn.example.test/p.jpg", id: opts.userId });
      expect(await adapter.fetchProfile(creds, opts.userId)).toEqual({
        name: "Nguyễn Văn An",
        avatarRef: "https://cdn.example.test/p.jpg",
      });
      const url = new URL(fetchMock.mock.calls[0][0] as string);
      expect(url.pathname).toMatch(new RegExp(`/${opts.userId}$`));
      expect(url.searchParams.get("fields")).toBe(opts.profileFields);

      reply(200, { name: "Khách B", id: opts.userId });
      expect(await adapter.fetchProfile(creds, opts.userId)).toEqual({ name: "Khách B" });
    });

    describe("8. thời hạn trả lời và thẻ HUMAN_AGENT", () => {
      const sentBody = () => JSON.parse((fetchMock.mock.calls.at(-1)![1] as RequestInit).body as string);

      it("trong 24 giờ: gửi RESPONSE, không gắn thẻ", async () => {
        reply(200, { message_id: "m1" });
        await adapter.sendText(creds, opts.userId, "chào", hoursAgo(23), now);
        expect(sentBody()).toMatchObject({ messaging_type: "RESPONSE", recipient: { id: opts.userId }, message: { text: "chào" } });
        expect(sentBody().tag).toBeUndefined();
      });

      it("24 giờ – 7 ngày: có thẻ HUMAN_AGENT khi bật, window_expired khi tắt", async () => {
        process.env.META_HUMAN_AGENT = "true";
        expect(adapter.replyWindowHours()).toBe(168);
        reply(200, { message_id: "m2" });
        await adapter.sendText(creds, opts.userId, "chào", hoursAgo(30), now);
        expect(sentBody()).toMatchObject({ messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" });

        process.env.META_HUMAN_AGENT = "false";
        expect(adapter.replyWindowHours()).toBe(24);
        fetchMock.mockClear();
        expect(await adapter.sendText(creds, opts.userId, "chào", hoursAgo(30), now)).toMatchObject({
          ok: false,
          error: "window_expired",
        });
        expect(fetchMock).not.toHaveBeenCalled();
      });

      it("quá 7 ngày: luôn window_expired", async () => {
        process.env.META_HUMAN_AGENT = "true";
        expect(await adapter.sendText(creds, opts.userId, "chào", hoursAgo(169), now)).toMatchObject({
          ok: false,
          error: "window_expired",
        });
        expect(fetchMock).not.toHaveBeenCalled();
      });
    });
  });
}
