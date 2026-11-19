import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { removeTrial, setTrial } from "@/server/schedule/trial";
import { SLOT_KEYS } from "@/lib/slots";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date phải có dạng YYYY-MM-DD"),
  slot: z.enum(SLOT_KEYS),
});

/** Tạo hoặc chuyển buổi học thử (ghi đè). */
export const PUT = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  const { date, slot } = await parseBody(req, Body);
  await setTrial(id, date, slot);
  return Response.json({ ok: true });
});

export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  await removeTrial(id);
  return Response.json({ ok: true });
});
