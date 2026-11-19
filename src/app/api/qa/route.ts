import { z } from "zod";
import { requireOwner, requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { createQa, listQa } from "@/server/qa/qa";

export const GET = route(async (req) => {
  await requireUser(req);
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return Response.json({ items: await listQa(q) });
});

const Body = z.object({ question: z.string().max(2000), answer: z.string().max(10000) });

export const POST = route(async (req) => {
  const user = await requireOwner(req);
  return Response.json(await createQa(await parseBody(req, Body), user.id), { status: 201 });
});
