import { requireUser } from "@/server/auth/guards";
import { route } from "@/server/http";
import { getConversation } from "@/server/inbox/conversations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  return Response.json(await getConversation(id));
});
