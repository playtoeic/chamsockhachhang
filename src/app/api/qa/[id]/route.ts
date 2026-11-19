import { z } from "zod";
import { requireOwner } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { deleteQa, updateQa } from "@/server/qa/qa";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  question: z.string().max(2000).optional(),
  answer: z.string().max(10000).optional(),
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireOwner(req);
  const { id } = await ctx.params;
  return Response.json(await updateQa(id, await parseBody(req, Body), user.id));
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireOwner(req);
  const { id } = await ctx.params;
  await deleteQa(id);
  return Response.json({ ok: true });
});
