import { requireUser } from "@/server/auth/guards";
import { route } from "@/server/http";
import { retryMessage } from "@/server/inbox/send";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  return Response.json(await retryMessage(id));
});
