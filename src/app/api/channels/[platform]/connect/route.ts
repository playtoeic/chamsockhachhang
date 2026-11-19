import { requireOwner } from "@/server/auth/guards";
import { beginConnect, STATE_COOKIE } from "@/server/channels/connections";
import { route } from "@/server/http";

type Ctx = { params: Promise<{ platform: string }> };

export const POST = route<Ctx>(async (req, ctx) => {
  await requireOwner(req);
  const { platform } = await ctx.params;
  const { redirectUrl, state } = beginConnect(platform);
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return Response.json(
    { redirectUrl },
    {
      headers: {
        "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/api/channels; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
      },
    },
  );
});
