import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { deleteStudent, getStudent, updateStudent } from "@/server/students/students";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  return Response.json(await getStudent(id));
});

const Body = z.object({
  name: z.string().max(200).optional(),
  source: z.string().max(100).nullish(),
  note: z.string().max(2000).nullish(),
  status: z.enum(["considering", "trialed", "enrolled", "dropped"]).optional(),
});

export const PATCH = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  return Response.json(await updateStudent(id, await parseBody(req, Body)));
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  await deleteStudent(id);
  return Response.json({ ok: true });
});
