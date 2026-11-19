import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { listMessages } from "@/server/inbox/conversations";
import { sendReply } from "@/server/inbox/send";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  const cursor = new URL(req.url).searchParams.get("cursor") ?? undefined;
  return Response.json(await listMessages(id, cursor));
});

const Body = z.object({ body: z.string().max(5000) });

export const POST = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { id } = await ctx.params;
  const { body } = await parseBody(req, Body);
  const msg = await sendReply(id, user.id, body);
  return Response.json(msg, { status: 201 });
});
