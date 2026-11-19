import "@/server/init";
import { getAdapter } from "@/server/channels/registry";
import { receiveWebhook } from "@/server/inbox/receive";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ platform: string }> };

/** Bước xác minh webhook của nền tảng (ví dụ hub.challenge của Meta). Không dùng phiên đăng nhập. */
export async function GET(req: Request, ctx: Ctx) {
  const { platform } = await ctx.params;
  const adapter = getAdapter(platform);
  if (!adapter) return new Response("Not found", { status: 404 });
  const challenge = adapter.verifyChallenge(new URL(req.url));
  if (challenge === null) return new Response("Forbidden", { status: 403 });
  return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/** Sự kiện từ nền tảng: xác thực chữ ký, lưu, rồi trả 200 (contracts/api.md, "Webhook"). */
export async function POST(req: Request, ctx: Ctx) {
  const { platform } = await ctx.params;
  const raw = await req.text();
  const status = await receiveWebhook(platform, req.headers, raw);
  return new Response(status === 200 ? "ok" : "rejected", { status });
}
