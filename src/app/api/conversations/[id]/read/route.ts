import { requireUser } from "@/server/auth/guards";
import { route } from "@/server/http";
import { markRead } from "@/server/inbox/conversations";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  await markRead(id);
  return Response.json({ ok: true });
});
