import { requireOwner } from "@/server/auth/guards";
import { completeConnect, STATE_COOKIE } from "@/server/channels/connections";
import { ApiError, route } from "@/server/http";

type Ctx = { params: Promise<{ platform: string }> };

function readCookie(header: string | null, name: string): string | null {
  const hit = header?.split(";").map((p) => p.trim()).find((p) => p.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** Nền tảng chuyển hướng về đây sau khi chủ cấp quyền. */
export const GET = route<Ctx>(async (req, ctx) => {
  await requireOwner(req);
  const { platform } = await ctx.params;
  const url = new URL(req.url);
  const back = new URL("/settings/channels", process.env.APP_URL ?? url.origin);
  const clear = `${STATE_COOKIE}=; Path=/api/channels; HttpOnly; Max-Age=0`;
  try {
    await completeConnect(platform, url.searchParams, readCookie(req.headers.get("cookie"), STATE_COOKIE));
    back.searchParams.set("connected", platform);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error(`[channels ${platform}] kết nối thất bại`, e);
    back.searchParams.set("error", "Kết nối thất bại, vui lòng thử lại");
  }
  return new Response(null, { status: 303, headers: { Location: back.toString(), "Set-Cookie": clear } });
});
