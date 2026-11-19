import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, parseValue, route } from "@/server/http";
import { setStep } from "@/server/students/steps";
import { STEP_KEYS } from "@/lib/steps";

type Ctx = { params: Promise<{ id: string; step: string }> };

const Body = z.object({ done: z.boolean() });

export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser(req);
  const { id, step } = await ctx.params;
  const key = parseValue(step, z.enum(STEP_KEYS, { message: "Bước không hợp lệ" }));
  const { done } = await parseBody(req, Body);
  await setStep(id, key, done, user.id);
  return Response.json({ ok: true });
});
