import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { setAssignee } from "@/server/inbox/conversations";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ userId: z.string().min(1).nullable() });

export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const { userId } = await parseBody(req, Body);
  return Response.json(await setAssignee(user, id, userId));
});
