import { beforeEach, describe, expect, it } from "vitest";
import { signSimulator, simulator, simulatorState } from "@/server/channels/simulator";

const creds = { token: "sim" };
const at = "2026-11-16T03:00:00.000Z";

const payload = (events: unknown[]) => JSON.stringify({ accountId: "sim-account", events });

beforeEach(() => simulatorState.reset());

describe("adapter giả lập — bảo đảm hành vi (contracts/channel-adapter.md)", () => {
  it("1. verifyWebhook từ chối chữ ký sai hoặc thiếu, nhận chữ ký đúng", () => {
    const raw = payload([]);
    expect(simulator.verifyWebhook(new Headers(), raw)).toBe(false);
    expect(simulator.verifyWebhook(new Headers({ "x-simulator-signature": "sai" }), raw)).toBe(false);
    expect(
      simulator.verifyWebhook(new Headers({ "x-simulator-signature": signSimulator(raw) }), raw),
    ).toBe(true);
  });

  it("2. tin văn bản trả đúng một InboundMessage có đủ trường", () => {
    const out = simulator.parseWebhook(
      payload([{ type: "message", threadId: "t1", messageId: "m1", customerName: "Khách A", text: "Xin chào", sentAt: at }]),
    );
    expect(out).toEqual([
      {
        externalAccountId: "sim-account",
        externalThreadId: "t1",
        externalMessageId: "m1",
        direction: "inbound",
        customerName: "Khách A",
        kind: "text",
        body: "Xin chào",
        sentAt: new Date(at),
      },
    ]);
  });

  it("3. tin ảnh trả kind = image; loại khác trả unsupported kèm tên loại", () => {
    const out = simulator.parseWebhook(
      payload([
        { type: "message", threadId: "t1", messageId: "m1", attachment: { type: "image", ref: "sim://image/1" }, sentAt: at },
        { type: "message", threadId: "t1", messageId: "m2", attachment: { type: "video" }, sentAt: at },
      ]),
    );
    expect(out[0]).toMatchObject({ kind: "image", mediaRef: "sim://image/1" });
    expect(out[1]).toMatchObject({ kind: "unsupported", unsupportedType: "video" });
  });

  it("4. sự kiện không phải tin nhắn (đã xem, đang gõ) trả danh sách trống", () => {
    expect(
      simulator.parseWebhook(payload([{ type: "read", threadId: "t1" }, { type: "typing", threadId: "t1" }])),
    ).toEqual([]);
  });

  it("5. sendText ánh xạ mỗi lỗi của nền tảng sang đúng một mã chuẩn hoá", async () => {
    for (const code of ["window_expired", "disconnected", "rate_limited", "rejected", "unknown"] as const) {
      simulatorState.rejectWith = code;
      const r = await simulator.sendText(creds, "t1", "chào", null, new Date());
      expect(r).toEqual({ ok: false, error: code });
    }
    simulatorState.rejectWith = null;
    simulatorState.echoMode = "off";
    const ok = await simulator.sendText(creds, "t1", "chào", null, new Date());
    expect(ok).toMatchObject({ ok: true });
    expect(simulatorState.outbox.at(-1)).toMatchObject({ threadId: "t1", text: "chào" });
  });

  it("6. sự kiện báo lại tin trung tâm đã gửi trả direction = echo", () => {
    const out = simulator.parseWebhook(
      payload([{ type: "echo", threadId: "t1", messageId: "m9", text: "trả lời từ app", sentAt: at }]),
    );
    expect(out).toEqual([
      expect.objectContaining({ direction: "echo", externalMessageId: "m9", kind: "text", body: "trả lời từ app" }),
    ]);
  });

  it("7. fetchProfile trả tên và ảnh khi có; không có ảnh khi nền tảng không cung cấp", async () => {
    simulatorState.profiles.set("t1", { name: "Khách A", avatar: true });
    simulatorState.profiles.set("t2", { name: "Khách B", avatar: false });
    expect(await simulator.fetchProfile(creds, "t1")).toEqual({ name: "Khách A", avatarRef: "sim://avatar/t1" });
    expect(await simulator.fetchProfile(creds, "t2")).toEqual({ name: "Khách B" });
    const media = await simulator.fetchMedia(creds, "sim://avatar/t1");
    expect(media.contentType).toBe("image/png");
    expect(media.data.length).toBeGreaterThan(0);
  });
});
